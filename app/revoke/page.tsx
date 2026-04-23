"use client";

import { BrowserProvider, Contract } from "ethers";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/constants/config";

type RevokedEntry = {
  id: string;
  reason: string;
  revokedAt: string;
  txHash: string;
  revokedBy: string;
};

type CertificateListItem = {
  id?: string;
  imageHash: string;
  studentName: string;
  studentWalletAddress: string;
  documentType: "commendation" | "diploma" | "certificate";
  expirationTimestamp: number;
  status: number;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  revokeTxHash?: string;
};

type CertificatesListResponse = {
  total: number;
  items: CertificateListItem[];
};

const STORAGE_KEY = "certichain.revoked-certificates";
const CERTIFICATES_API_URL = process.env.NEXT_PUBLIC_CERTIFICATE_SAVE_API_URL?.trim() || "";

function ensureCertificatesApiUrl(): string {
  if (!CERTIFICATES_API_URL) {
    throw new Error(
      "Thieu NEXT_PUBLIC_CERTIFICATE_SAVE_API_URL. Vui long cau hinh URL API BE tren frontend."
    );
  }

  return CERTIFICATES_API_URL.replace(/\/+$/, "");
}

function normalizeDocumentType(value: unknown): CertificateListItem["documentType"] {
  if (typeof value !== "string") {
    return "certificate";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "commendation" || normalized === "giấy khen" || normalized === "giay khen") {
    return "commendation";
  }

  if (normalized === "diploma" || normalized === "bằng tốt nghiệp" || normalized === "bang tot nghiep") {
    return "diploma";
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
    if (normalized === "true" || normalized === "1" || normalized === "revoked") {
      return 1;
    }

    if (normalized === "false" || normalized === "0" || normalized === "issued") {
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

function toCertificateListItem(record: Record<string, unknown>): CertificateListItem | null {
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

  const statusCandidate =
    record.status ??
    record.Status ??
    record.isRevoked ??
    record.IsRevoked ??
    "0";

  return {
    id: readIdentifierField(record, ["id", "Id", "certificateId", "CertificateId"]) || imageHash,
    imageHash,
    studentName: readStringField(record, ["studentName", "StudentName", "student_name"]) || "(Chưa có tên)",
    studentWalletAddress:
      readStringField(record, [
        "studentWalletAddress",
        "StudentWalletAddress",
        "studentWallet",
        "StudentWallet",
        "student_wallet",
      ]) || "",
    documentType: normalizeDocumentType(
      readStringField(record, ["documentType", "DocumentType", "document_type"])
    ),
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
    revokeReason:
      readStringField(record, ["revokeReason", "RevokeReason", "reason", "Reason"]) || undefined,
    revokeTxHash:
      readStringField(record, ["revokeTxHash", "RevokeTxHash", "txHashRevoke", "tx_hash_revoke"]) || undefined,
  };
}

function normalizeCertificatesList(payload: unknown): CertificatesListResponse {
  const records = extractRecords(payload);
  const items = records
    .map((record) => toCertificateListItem(record))
    .filter((item): item is CertificateListItem => item !== null);

  return {
    total: items.length,
    items,
  };
}

function filterCertificatesList(
  items: CertificateListItem[],
  filters: {
    keyword: string;
    status: "all" | "0" | "1";
    documentType: "all" | "commendation" | "diploma" | "certificate";
  }
) {
  const keyword = filters.keyword.trim().toLowerCase();

  return items.filter((item) => {
    const matchesKeyword =
      !keyword ||
      item.imageHash.toLowerCase().includes(keyword) ||
      item.studentName.toLowerCase().includes(keyword) ||
      item.studentWalletAddress.toLowerCase().includes(keyword);

    const matchesStatus = filters.status === "all" || String(item.status) === filters.status;
    const matchesDocumentType =
      filters.documentType === "all" || item.documentType === filters.documentType;

    return matchesKeyword && matchesStatus && matchesDocumentType;
  });
}

function getDocumentTypeLabel(value: CertificateListItem["documentType"]): string {
  if (value === "commendation") return "Giấy khen";
  if (value === "diploma") return "Bằng tốt nghiệp";
  return "Giấy chứng nhận";
}

function getStatusLabel(status: number): string {
  return status === 1 ? "Đã thu hồi" : "Đang hiệu lực";
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}

async function readApiError(response: Response, fallbackMessage: string) {
  const bodyText = await response.text();
  if (!bodyText) {
    return fallbackMessage;
  }

  try {
    const payload = JSON.parse(bodyText) as {
      error?: unknown;
      details?: unknown;
      message?: unknown;
    };

    const parts = [payload.error, payload.details, payload.message]
      .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      .map((item) => item.trim());

    if (parts.length > 0) {
      return parts.join(" - ");
    }

    return bodyText;
  } catch {
    return bodyText;
  }
}

function getReadableRevokeError(error: unknown): string {
  if (error && typeof error === "object") {
    const withShortMessage = error as { shortMessage?: string; message?: string };
    const rawMessage = (withShortMessage.shortMessage ?? withShortMessage.message ?? "").toLowerCase();

    if (rawMessage.includes("user rejected") || rawMessage.includes("rejected")) {
      return "Bạn đã hủy yêu cầu ký giao dịch trong MetaMask.";
    }

    if (rawMessage.includes("insufficient funds")) {
      return "Ví không đủ gas để thực hiện giao dịch thu hồi.";
    }

    if (rawMessage.includes("already revoked")) {
      return "Bằng này đã bị thu hồi trước đó trên blockchain.";
    }

    if (rawMessage.includes("certificate not found")) {
      return "Không tìm thấy chứng chỉ trên blockchain. Vui lòng nhập đúng hash metadata dạng 0x... (không dùng mã CERT-...).";
    }

    if (rawMessage.includes("owner") || rawMessage.includes("caller is not the owner")) {
      return "Ví hiện tại không có quyền thu hồi. Vui lòng dùng ví owner của hợp đồng.";
    }

    if (rawMessage) {
      return `Không thể thu hồi: ${withShortMessage.shortMessage ?? withShortMessage.message}`;
    }
  }

  return "Không thể thu hồi bằng trên blockchain. Vui lòng thử lại.";
}

export default function RevokeCertificatePage() {
  const [certificateId, setCertificateId] = useState("");
  const [reason, setReason] = useState("Không đạt điều kiện xác thực nội bộ");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "0" | "1">("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<"all" | "commendation" | "diploma" | "certificate">("all");
  const [apiCertificates, setApiCertificates] = useState<CertificateListItem[]>([]);
  const [visibleCertificates, setVisibleCertificates] = useState<CertificateListItem[]>([]);
  const [apiTotal, setApiTotal] = useState(0);
  const [isLoadingCertificates, setIsLoadingCertificates] = useState(false);
  const [entries, setEntries] = useState<RevokedEntry[]>([]);
  const [message, setMessage] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);

  const isMetadataHash = (value: string) => /^0x[a-fA-F0-9]{64}$/.test(value);

  const total = useMemo(() => entries.length, [entries]);

  const persist = (nextEntries: RevokedEntry[]) => {
    setEntries(nextEntries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
  };

  const fetchCertificates = async (override?: {
    keyword?: string;
    status?: "all" | "0" | "1";
    documentType?: "all" | "commendation" | "diploma" | "certificate";
  }) => {
    const nextKeyword = override?.keyword ?? searchKeyword;
    const nextStatus = override?.status ?? statusFilter;
    const nextDocumentType = override?.documentType ?? documentTypeFilter;
    const nextFilters = {
      keyword: nextKeyword,
      status: nextStatus,
      documentType: nextDocumentType,
    };

    const params = new URLSearchParams();
    if (nextKeyword.trim()) {
      params.set("q", nextKeyword.trim());
    }
    if (nextDocumentType !== "all") {
      params.set("documentType", nextDocumentType);
    }

    setIsLoadingCertificates(true);
    try {
      const apiBaseUrl = ensureCertificatesApiUrl();
      const url = params.toString()
        ? `${apiBaseUrl}?${params.toString()}`
        : apiBaseUrl;
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        const reason = await readApiError(
          response,
          `Không tải được danh sách bằng (${response.status}).`
        );
        throw new Error(reason);
      }

      const payload = (await response.json()) as unknown;
      const normalized = normalizeCertificatesList(payload);
      setApiCertificates(normalized.items);
      setApiTotal(normalized.total);
      setVisibleCertificates(filterCertificatesList(normalized.items, nextFilters));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể tải danh sách bằng.";
      setMessage(errorMessage);
    } finally {
      setIsLoadingCertificates(false);
    }
  };

  useEffect(() => {
    void fetchCertificates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as RevokedEntry[];
      if (Array.isArray(parsed)) {
        setEntries(parsed);
      }
    } catch {
      setEntries([]);
    }
  }, []);

  const syncRevokeToApi = async (id: string, payload: { reason: string; revokedBy: string; txHash: string }) => {
    const apiBaseUrl = ensureCertificatesApiUrl();
    const response = await fetch(`${apiBaseUrl}/${encodeURIComponent(id)}/revoke`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(true),
    });

    if (!response.ok) {
      const reason = await readApiError(
        response,
        `API revoke failed with status ${response.status}`
      );
      throw new Error(reason);
    }

    return response.json();
  };

  const resolveBackendRevokeId = async (hash: string): Promise<string> => {
    const apiBaseUrl = ensureCertificatesApiUrl();
    const byHashResponse = await fetch(`${apiBaseUrl}?hash=${encodeURIComponent(hash)}`, {
      cache: "no-store",
    });

    if (byHashResponse.ok) {
      const payload = (await byHashResponse.json()) as Record<string, unknown>;

      const candidateId = readIdentifierField(payload, ["id", "Id", "certificateId", "CertificateId"]);
      if (candidateId) {
        return candidateId;
      }
    }

    const listResponse = await fetch(apiBaseUrl, { cache: "no-store" });
    if (!listResponse.ok) {
      return hash;
    }

    const payload = (await listResponse.json()) as unknown;
    const rows = normalizeCertificatesList(payload).items;
    const matched = rows.find((item) => item.imageHash.toLowerCase() === hash.toLowerCase());
    if (matched?.id?.trim()) {
      return matched.id.trim();
    }

    return hash;
  };

  const handleFilterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchCertificates();
  };

  const handleResetFilters = async () => {
    setSearchKeyword("");
    setStatusFilter("all");
    setDocumentTypeFilter("all");
    await fetchCertificates({ keyword: "", status: "all", documentType: "all" });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedId = certificateId.trim();
    const normalizedReason = reason.trim();

    if (!normalizedId) {
      setMessage("Vui lòng nhập mã bằng/hash trước khi thu hồi.");
      return;
    }

    if (!isMetadataHash(normalizedId)) {
      setMessage("Giá trị thu hồi phải là hash metadata dạng 0x... (64 ký tự hex), không phải mã CERT-...");
      return;
    }

    if (!window.ethereum) {
      setMessage("Không tìm thấy MetaMask. Vui lòng cài đặt và thử lại.");
      return;
    }

    const existed = entries.some((entry) => entry.id.toLowerCase() === normalizedId.toLowerCase());
    if (existed) {
      setMessage("Mã này đã có trong danh sách thu hồi.");
      return;
    }

    setIsRevoking(true);
    setMessage("Đang kết nối ví và gửi giao dịch thu hồi...");

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      setConnectedWallet(walletAddress);

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const ownerAddress = (await contract.owner()) as string;

      if (walletAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
        setMessage("Ví hiện tại không phải owner của hợp đồng nên không thể thu hồi.");
        return;
      }

      const tx = await contract.revokeCertificate(normalizedId);
      setMessage("Đã gửi giao dịch. Đang chờ blockchain xác nhận...");

      const receipt = await tx.wait();
      const txHash = (receipt?.hash ?? tx.hash ?? "").toString();

      const nextEntry: RevokedEntry = {
        id: normalizedId,
        reason: normalizedReason || "Không có lý do",
        revokedAt: new Date().toISOString(),
        txHash,
        revokedBy: walletAddress,
      };

      let syncMessage = "";
      try {
        const matchedCertificate = apiCertificates.find(
          (item) => item.imageHash.toLowerCase() === normalizedId.toLowerCase()
        );
        const fallbackId = matchedCertificate?.id?.trim() || normalizedId;
        const backendRevokeId = await resolveBackendRevokeId(fallbackId === normalizedId ? normalizedId : fallbackId);

        await syncRevokeToApi(backendRevokeId, {
          reason: normalizedReason || "Không có lý do",
          revokedBy: walletAddress,
          txHash,
        });
        syncMessage = " Đã đồng bộ trạng thái thu hồi qua API.";
      } catch (syncError) {
        const syncErrorMessage =
          syncError instanceof Error ? syncError.message : "Không đồng bộ được trạng thái thu hồi.";
        syncMessage = ` Không đồng bộ API: ${syncErrorMessage}`;
      }

      const nextEntries = [nextEntry, ...entries];
      persist(nextEntries);
      setCertificateId("");
      setMessage(`Đã thu hồi bằng thành công trên blockchain. Tx: ${txHash}.${syncMessage}`);
      await fetchCertificates();
    } catch (error) {
      setMessage(getReadableRevokeError(error));
    } finally {
      setIsRevoking(false);
    }
  };

  const handleRemove = (id: string) => {
    const nextEntries = entries.filter((entry) => entry.id !== id);
    persist(nextEntries);
  };

  const handleClearAll = () => {
    persist([]);
    setMessage("Đã xóa toàn bộ danh sách thu hồi nội bộ.");
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 lg:py-14">
      <header className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 px-6 py-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Test Utility</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Thu hồi bằng (On-chain)</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700 sm:text-base">
          Trang này gọi trực tiếp hàm revokeCertificate trên smart contract bằng MetaMask.
          Lịch sử bên dưới chỉ là bản ghi local để tiện theo dõi.
        </p>
        {connectedWallet && (
          <p className="mt-2 break-all text-xs font-medium text-slate-700">Ví đang dùng: {connectedWallet}</p>
        )}
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2">
            <label htmlFor="cert-id" className="text-sm font-semibold text-slate-800">
              Hash metadata trên blockchain
            </label>
            <input
              id="cert-id"
              type="text"
              value={certificateId}
              onChange={(event) => setCertificateId(event.target.value)}
              placeholder="Ví dụ: 0x4a1c... (64 ký tự hex)"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
            />
            <p className="text-xs text-slate-500">
              Lưu ý: Hợp đồng chỉ thu hồi theo hash metadata (0x...). Mã chứng chỉ dạng CERT-... sẽ không thu hồi được.
            </p>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <label htmlFor="reason" className="text-sm font-semibold text-slate-800">
              Lý do thu hồi
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
            />
          </div>

          <button
            type="submit"
            disabled={isRevoking}
            className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            {isRevoking ? "Đang thu hồi..." : "Thu hồi bằng trên blockchain"}
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Xóa toàn bộ danh sách
          </button>
        </form>

        {message && <p className="mt-4 text-sm font-medium text-slate-700">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleFilterSubmit} className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
          <div className="grid gap-2 md:col-span-2">
            <label htmlFor="search-keyword" className="text-sm font-semibold text-slate-800">
              Tìm nhanh
            </label>
            <input
              id="search-keyword"
              type="text"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="Nhập hash, tên sinh viên hoặc ví..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="status-filter" className="text-sm font-semibold text-slate-800">
              Trạng thái
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "0" | "1")}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
            >
              <option value="all">Tất cả</option>
              <option value="0">Đang hiệu lực</option>
              <option value="1">Đã thu hồi</option>
            </select>
          </div>

          <div className="grid gap-2">
            <label htmlFor="type-filter" className="text-sm font-semibold text-slate-800">
              Loại giấy tờ
            </label>
            <select
              id="type-filter"
              value={documentTypeFilter}
              onChange={(event) =>
                setDocumentTypeFilter(
                  event.target.value as "all" | "commendation" | "diploma" | "certificate"
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
            >
              <option value="all">Tất cả</option>
              <option value="commendation">Giấy khen</option>
              <option value="diploma">Bằng tốt nghiệp</option>
              <option value="certificate">Giấy chứng nhận</option>
            </select>
          </div>

          <div className="md:col-span-4 flex flex-wrap gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Lọc danh sách
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Xóa bộ lọc
            </button>
            <button
              type="button"
              onClick={() => void fetchCertificates()}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Tải lại từ API
            </button>
          </div>
        </form>

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">Danh sách bằng từ API</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            {apiTotal} mục
          </span>
        </div>

        {isLoadingCertificates ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Đang tải danh sách bằng...
          </p>
        ) : visibleCertificates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Không có bản ghi nào khớp điều kiện lọc.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleCertificates.map((item) => (
              <article key={item.id || item.imageHash} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.studentName}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.status === 1
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {getStatusLabel(item.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">Loại: {getDocumentTypeLabel(item.documentType)}</p>
                <p className="mt-1 break-all text-xs text-slate-600">Ví: {item.studentWalletAddress}</p>
                <p className="mt-1 break-all text-xs text-slate-600">Hash: {item.imageHash}</p>
                {item.revokedAt && (
                  <p className="mt-1 text-xs text-slate-500">Đã thu hồi lúc: {formatTimestamp(item.revokedAt)}</p>
                )}
                <button
                  type="button"
                  onClick={() => setCertificateId(item.imageHash)}
                  disabled={item.status === 1}
                  className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {item.status === 1 ? "Đã thu hồi" : "Chọn hash để thu hồi"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">Danh sách thu hồi nội bộ</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            {total} mục
          </span>
        </div>

        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Chưa có bản ghi thu hồi nào.
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="break-all text-sm font-semibold text-slate-900">{entry.id}</p>
                <p className="mt-1 text-sm text-slate-700">Lý do: {entry.reason}</p>
                <p className="mt-1 break-all text-xs text-slate-600">Ví thu hồi: {entry.revokedBy}</p>
                <p className="mt-1 break-all text-xs text-slate-600">Tx hash: {entry.txHash}</p>
                <p className="mt-1 text-xs text-slate-500">Thu hồi lúc: {formatTimestamp(entry.revokedAt)}</p>
                <button
                  type="button"
                  onClick={() => handleRemove(entry.id)}
                  className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Xóa mục này
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
