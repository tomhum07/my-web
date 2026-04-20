import { NextRequest, NextResponse } from "next/server";

interface CertificateData {
  studentName: string;
  studentWalletAddress: string;
  imageHash: string;
  metadataJson?: string;
  documentType: "commendation" | "diploma" | "certificate";
  expirationTimestamp: number;
}

const CERTIFICATE_SAVE_API_URL =
  process.env.CERTIFICATE_SAVE_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_CERTIFICATE_SAVE_API_URL?.trim() ||
  "";

// Store certificates in memory (in production, use a database)
const certificateStore = new Map<string, CertificateData>();

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
      return [httpsLocalUrl.toString()];
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
    const documentType = pickFormDataString(formData, ["documentType", "DocumentType"]);
    const expirationTimestamp = normalizeNumber(
      pickFormDataString(formData, ["expirationTimestamp", "ExpirationTimestamp"])
    );

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
      documentType: documentType as "commendation" | "diploma" | "certificate",
      expirationTimestamp,
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
    // Get certificate by hash
    const imageHash = request.nextUrl.searchParams.get("hash");

    if (!imageHash) {
      return NextResponse.json(
        { error: "Hash parameter required" },
        { status: 400 }
      );
    }

    const certificate = certificateStore.get(imageHash);

    if (!certificate) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(certificate, { status: 200 });
  } catch (error) {
    console.error("Certificate lookup error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to lookup certificate: ${errorMessage}` },
      { status: 500 }
    );
  }
}
