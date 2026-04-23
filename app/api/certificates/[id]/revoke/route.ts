import { NextRequest, NextResponse } from "next/server";

import { certificateStore } from "../../store";
import { getExternalConfigError, getExternalTargets, shouldProxyToExternal } from "../../externalConfig";

type RevokePayload = {
  reason?: string;
  revokedBy?: string;
  txHash?: string;
};

function isIntegerLike(value: string) {
  return /^\d+$/.test(value);
}

function extractRecords(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const root = payload as Record<string, unknown>;
  const candidates = [root.value, root.items, root.data, root.results, root.records];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    }
  }

  return [root];
}

async function resolveExternalCertificateId(
  target: string,
  certificateId: string,
  allowInsecureLocalTls: boolean
) {
  if (isIntegerLike(certificateId)) {
    return certificateId;
  }

  const listResponse = await fetchWithOptionalInsecureLocalTls(
    target,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
    allowInsecureLocalTls
  );

  if (!listResponse.ok) {
    return certificateId;
  }

  const listPayload = (await listResponse.json()) as unknown;
  const records = extractRecords(listPayload);
  const matched = records.find((record) => {
    const hashCandidates = [record.certHash, record.CertHash, record.imageHash, record.ImageHash, record.metadata_hash];
    return hashCandidates.some(
      (value) => typeof value === "string" && value.toLowerCase() === certificateId.toLowerCase()
    );
  });

  const rawId = matched?.id ?? matched?.Id ?? matched?.certificateId ?? matched?.CertificateId;
  if (typeof rawId === "number" && Number.isFinite(rawId)) {
    return String(rawId);
  }

  if (typeof rawId === "string" && rawId.trim()) {
    return rawId.trim();
  }

  return certificateId;
}

async function fetchWithOptionalInsecureLocalTls(
  url: string,
  init: RequestInit,
  allowInsecureLocalTls: boolean
) {
  if (!allowInsecureLocalTls) {
    return fetch(url, init);
  }

  const previousTlsConfig = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  try {
    return await fetch(url, init);
  } finally {
    if (previousTlsConfig === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTlsConfig;
    }
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const configError = getExternalConfigError(request);
    if (configError) {
      return NextResponse.json(
        {
          error: "Certificate API configuration error",
          details: configError,
        },
        { status: 503 }
      );
    }

    const { id } = await context.params;
    const certificateId = decodeURIComponent(id || "").trim();

    if (!certificateId) {
      return NextResponse.json({ error: "Certificate id is required" }, { status: 400 });
    }

    let payload: RevokePayload = {};
    try {
      payload = (await request.json()) as RevokePayload;
    } catch {
      payload = {};
    }

    if (shouldProxyToExternal(request)) {
      const targets = getExternalTargets(request);
      let lastProxyError = "";

      for (const target of targets) {
        const targetUrl = new URL(target);
        const shouldAllowInsecureLocalTls =
          process.env.NODE_ENV !== "production" &&
          targetUrl.protocol === "https:" &&
          targetUrl.hostname === "localhost";

        const resolvedId = await resolveExternalCertificateId(
          target,
          certificateId,
          shouldAllowInsecureLocalTls
        );
        const revokeUrl = `${target.replace(/\/+$/, "")}/${encodeURIComponent(resolvedId)}/revoke`;

        try {
          const upstream = await fetchWithOptionalInsecureLocalTls(
            revokeUrl,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(true),
            },
            shouldAllowInsecureLocalTls
          );

          const responseText = await upstream.text();
          let responseJson: unknown = null;
          try {
            responseJson = responseText ? (JSON.parse(responseText) as unknown) : null;
          } catch {
            responseJson = { message: responseText };
          }

          if (upstream.ok) {
            return NextResponse.json(
              responseJson ?? {
                success: true,
                message: "Revoked successfully",
              },
              { status: upstream.status }
            );
          }

          lastProxyError =
            `Target ${revokeUrl} rejected revoke (${upstream.status}): ` +
            (responseText || upstream.statusText);
        } catch (proxyError) {
          const message = proxyError instanceof Error ? proxyError.message : String(proxyError);
          lastProxyError = `Target ${revokeUrl} request failed: ${message}`;
        }
      }

      return NextResponse.json(
        {
          error: "Backend revoke failed",
          details: lastProxyError,
        },
        { status: 502 }
      );
    }

    const certificate = certificateStore.get(certificateId);
    if (!certificate) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    const updated = {
      ...certificate,
      status: 1,
      revokedAt: nowIso,
      revokedBy: payload.revokedBy?.trim() || certificate.revokedBy,
      revokeReason: payload.reason?.trim() || certificate.revokeReason,
      revokeTxHash: payload.txHash?.trim() || certificate.revokeTxHash,
    };

    certificateStore.set(certificateId, updated);

    return NextResponse.json(
      {
        success: true,
        message: "Certificate status updated to revoked",
        certificate: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to revoke certificate: ${errorMessage}` },
      { status: 500 }
    );
  }
}
