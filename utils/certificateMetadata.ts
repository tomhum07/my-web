import CryptoJS from "crypto-js";

export const CERTIFICATE_METADATA_QR_PREFIX = "CERT_META_V1:";

export type CertificateMetadata = {
  version: 1;
  documentType: "commendation" | "diploma" | "certificate";
  studentName: string;
  studentWalletAddress: string;
  issueDateIso: string;
  expirationTimestamp: number;
  certificateCode: string;
};

function normalizeValue(value: unknown): string | number | boolean {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return "";
}

export function serializeCertificateMetadata(metadata: CertificateMetadata): string {
  const normalizedEntries = Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, normalizeValue(value)] as const)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  return JSON.stringify(Object.fromEntries(normalizedEntries));
}

export function hashMetadataJson(metadataJson: string): string {
  const utf8Words = CryptoJS.enc.Utf8.parse(metadataJson);
  const hash = CryptoJS.SHA256(utf8Words).toString();
  return `0x${hash}`;
}

export function encodeMetadataForQr(metadataJson: string): string {
  return `${CERTIFICATE_METADATA_QR_PREFIX}${metadataJson}`;
}

export function decodeMetadataFromQr(rawPayload: string): string {
  if (!rawPayload.startsWith(CERTIFICATE_METADATA_QR_PREFIX)) {
    throw new Error("QR không chứa metadata chứng chỉ hợp lệ.");
  }

  const jsonPayload = rawPayload.slice(CERTIFICATE_METADATA_QR_PREFIX.length);

  try {
    JSON.parse(jsonPayload);
  } catch {
    throw new Error("Metadata trong QR không phải JSON hợp lệ.");
  }

  return jsonPayload;
}
