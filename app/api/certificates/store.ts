export type CertificateDocumentType = "commendation" | "diploma" | "certificate";

export interface CertificateData {
  id?: string;
  studentName: string;
  studentWalletAddress: string;
  imageHash: string;
  metadataJson?: string;
  documentType: CertificateDocumentType;
  expirationTimestamp: number;
  status: number;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  revokeTxHash?: string;
}

// In-memory store for demo mode. Replace with database in production.
export const certificateStore = new Map<string, CertificateData>();
