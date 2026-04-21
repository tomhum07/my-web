import { NextRequest, NextResponse } from "next/server";
import { certificateStore, CertificateData } from "./store";

const CERTIFICATE_SAVE_API_URL =
  process.env.CERTIFICATE_SAVE_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_CERTIFICATE_SAVE_API_URL?.trim() ||
  "";

function pickFormDataEntry(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const entry = formData.get(key);
    if (entry !== null) {
      return entry;
    }
  }

  return null;
}

function pickFormDataString(formData: FormData, keys: string[]) {
  const entry = pickFormDataEntry(formData, keys);
  return typeof entry === "string" ? entry : "";
}

function pickFormDataFile(formData: FormData, keys: string[]) {
  const entry = pickFormDataEntry(formData, keys);
  return entry instanceof File ? entry : null;
}

function normalizeNumber(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDocumentType(value: string): CertificateData["documentType"] {
  const normalized = value.trim().toLowerCase();

  if (normalized === "commendation" || normalized === "giấy khen" || normalized === "giay khen") {
    return "commendation";
  }

  if (normalized === "diploma" || normalized === "bằng tốt nghiệp" || normalized === "bang tot nghiep") {
    return "diploma";
  }

  if (normalized === "certificate" || normalized === "giấy chứng nhận" || normalized === "giay chung nhan") {
    return "certificate";
  }

  return "certificate";
}

function normalizeStatus(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return 0;
    }

    if (normalized === "1" || normalized === "true" || normalized === "revoked") {
      return 1;
    }

    if (normalized === "0" || normalized === "false" || normalized === "issued") {
      return 0;
    }

    const parsed = Number.parseInt(normalized, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function readStringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function readIdentifierField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function readNumberField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function toCertificateData(record: Record<string, unknown>): CertificateData | null {
  const imageHash = readStringField(record, [
    "imageHash",
    "ImageHash",
    "metadata_hash",
    "metadataHash",
    "certHash",
    "CertHash",
    "hash",
    "Hash",
  ]);

  if (!imageHash) {
    return null;
  }

  const studentName = readStringField(record, ["studentName", "StudentName", "student_name"]);
  const studentWalletAddress = readStringField(record, [
    "studentWalletAddress",
    "StudentWalletAddress",
    "studentWallet",
    "StudentWallet",
    "student_wallet",
  ]);
  const documentTypeRaw = readStringField(record, ["documentType", "DocumentType", "document_type"]);
  const metadataJson = readStringField(record, ["metadataJson", "MetadataJson", "metadata_json"]);
  const id = readIdentifierField(record, ["id", "Id", "certificateId", "CertificateId"]);

  const statusCandidate =
    record.status ??
    record.Status ??
    record.isRevoked ??
    record.IsRevoked ??
    "0";

  return {
    id: id || imageHash,
    studentName: studentName || "(Chưa có tên)",
    studentWalletAddress: studentWalletAddress || "",
    imageHash,
    metadataJson: metadataJson || undefined,
    documentType: normalizeDocumentType(documentTypeRaw || "certificate"),
    expirationTimestamp: readNumberField(record, [
      "expirationTimestamp",
      "ExpirationTimestamp",
      "expiration_timestamp",
      "expirationDate",
      "ExpirationDate",
    ]),
    status: normalizeStatus(statusCandidate),
    revokedAt: readStringField(record, ["revokedAt", "RevokedAt", "revoked_at"]) || undefined,
    revokedBy: readStringField(record, ["revokedBy", "RevokedBy", "revoked_by"]) || undefined,
    revokeReason: readStringField(record, ["revokeReason", "RevokeReason", "reason", "Reason"]) || undefined,
    revokeTxHash: readStringField(record, ["revokeTxHash", "RevokeTxHash", "txHashRevoke", "tx_hash_revoke"]) || undefined,
  };
}

function extractRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = payload as Record<string, unknown>;
  const listCandidates = [data.items, data.data, data.results, data.records, data.value];

  for (const candidate of listCandidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    }
  }

  return [data];
}

async function fetchExternalCertificates(request: NextRequest): Promise<CertificateData[] | null> {
  const targets = getExternalTargets(request);
  if (targets.length === 0) {
    return null;
  }

  let lastError = "";

  for (const target of targets) {
    const targetUrl = new URL(target);
    const allowInsecureLocalTls =
      process.env.NODE_ENV !== "production" &&
      targetUrl.protocol === "https:" &&
      targetUrl.hostname === "localhost";

    try {
      const response = await fetchWithOptionalInsecureLocalTls(
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

      if (!response.ok) {
        const text = await response.text();
        lastError = `Target ${target} rejected list (${response.status}): ${text || response.statusText}`;
        continue;
      }

      const payload = (await response.json()) as unknown;
      const records = extractRecords(payload);
      const normalized = records
        .map((record) => toCertificateData(record))
        .filter((item): item is CertificateData => item !== null);

      return normalized;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = `Target ${target} request failed: ${message}`;
    }
  }

  throw new Error(lastError || "Failed to fetch certificates from backend");
}

function cloneFormData(source: FormData) {
  const cloned = new FormData();

  for (const [key, value] of source.entries()) {
    if (typeof value === "string") {
      cloned.append(key, value);
      continue;
    }

    cloned.append(key, value, value.name);
  }

  return cloned;
}

function shouldProxyToExternal(request: NextRequest) {
  return getExternalTargets(request).length > 0;
}

function getExternalTargets(request: NextRequest) {
  if (!CERTIFICATE_SAVE_API_URL) {
    return [];
  }

  try {
    const configured = new URL(CERTIFICATE_SAVE_API_URL);
    const currentOrigin = request.nextUrl.origin;
    if (configured.origin === currentOrigin) {
      return [];
    }

    // Common local ASP.NET setup: HTTP endpoint redirects to HTTPS on 7172.
    if (
      configured.protocol === "http:" &&
      configured.hostname === "localhost" &&
      configured.port === "5086"
    ) {
      const httpsLocalUrl = new URL(configured.toString());
      httpsLocalUrl.protocol = "https:";
      httpsLocalUrl.port = "7172";
      return [httpsLocalUrl.toString(), configured.toString()];
    }

    const targets: string[] = [configured.toString()];

    return Array.from(new Set(targets));
  } catch {
    return [];
  }
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract form fields
    const image = pickFormDataFile(formData, ["image", "Image", "file", "File"]);
    const studentName = pickFormDataString(formData, ["studentName", "StudentName"]);
    const studentWalletAddress = pickFormDataString(formData, [
      "studentWalletAddress",
      "StudentWalletAddress",
      "studentWallet",
      "StudentWallet",
    ]);
    const imageHash = pickFormDataString(formData, ["imageHash", "ImageHash", "certHash", "CertHash"]);
    const metadataJson = pickFormDataString(formData, ["metadataJson", "MetadataJson"]) || null;
    const documentType = normalizeDocumentType(
      pickFormDataString(formData, ["documentType", "DocumentType"])
    );
    const expirationTimestamp = normalizeNumber(
      pickFormDataString(formData, ["expirationTimestamp", "ExpirationTimestamp"])
    );
    const status = normalizeNumber(pickFormDataString(formData, ["status", "Status"]));

    // Validate required fields
    if (!image || !studentName || !studentWalletAddress || !imageHash) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate image is actually an image
    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Uploaded file must be an image" },
        { status: 400 }
      );
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

        try {
          const requestInit: RequestInit = {
            method: "POST",
            body: cloneFormData(formData),
          };
          const upstreamResponse = await fetchWithOptionalInsecureLocalTls(
            target,
            requestInit,
            shouldAllowInsecureLocalTls
          );
          const upstreamText = await upstreamResponse.text();

          if (upstreamResponse.ok) {
            lastProxyError = "";
            break;
          }

          lastProxyError =
            `Target ${target} rejected upload (${upstreamResponse.status}): ` +
            (upstreamText || upstreamResponse.statusText);
        } catch (proxyError) {
          const message = proxyError instanceof Error ? proxyError.message : String(proxyError);
          lastProxyError = `Target ${target} request failed: ${message}`;
        }
      }

      if (lastProxyError) {
        return NextResponse.json(
          {
            error: "Backend rejected upload",
            details: lastProxyError,
          },
          { status: 502 }
        );
      }
    }

    // Store certificate metadata
    const certificateData: CertificateData = {
      studentName,
      studentWalletAddress,
      imageHash,
      metadataJson: metadataJson?.trim() || undefined,
      documentType,
      expirationTimestamp,
      status,
    };

    // Use imageHash as the key for fast lookup during verification
    certificateStore.set(imageHash, certificateData);

    console.log(`Certificate stored for hash: ${imageHash}`);
    console.log("Certificate data:", certificateData);

    return NextResponse.json(
      {
        success: true,
        message: "Certificate saved successfully",
        imageHash,
        studentName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Certificate upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process certificate: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get certificate by hash if provided.
    const imageHash = request.nextUrl.searchParams.get("hash");
    const keyword = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const statusFilter = request.nextUrl.searchParams.get("status")?.trim() ?? "all";
    const documentTypeFilter = request.nextUrl.searchParams.get("documentType")?.trim() ?? "all";

    const externalRows = shouldProxyToExternal(request)
      ? await fetchExternalCertificates(request)
      : null;

    if (imageHash) {
      const certificate = externalRows
        ? externalRows.find((item) => item.imageHash.toLowerCase() === imageHash.toLowerCase())
        : certificateStore.get(imageHash);

      if (!certificate) {
        return NextResponse.json(
          { error: "Certificate not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(certificate, { status: 200 });
    }

    const rows = externalRows ?? Array.from(certificateStore.values()).map((item) => ({
      ...item,
      id: item.id || item.imageHash,
      documentType: normalizeDocumentType(item.documentType),
    }));

    const filtered = rows.filter((item) => {
      const matchesKeyword =
        !keyword ||
        item.imageHash.toLowerCase().includes(keyword) ||
        item.studentName.toLowerCase().includes(keyword) ||
        item.studentWalletAddress.toLowerCase().includes(keyword);

      const matchesStatus = statusFilter === "all" || String(item.status) === statusFilter;
      const matchesDocumentType =
        documentTypeFilter === "all" || item.documentType === documentTypeFilter;

      return matchesKeyword && matchesStatus && matchesDocumentType;
    });

    return NextResponse.json(
      {
        total: filtered.length,
        items: filtered,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Certificate lookup error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to lookup certificate: ${errorMessage}` },
      { status: 500 }
    );
  }
}
