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
const CERTIFICATES_API_URL = "/api/certificates";

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
  const [statusFilter, setStatusFilter] = useState<"all" | "0" | "1">("0");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<"all" | "commendation" | "diploma" | "certificate">("all");
  const [apiCertificates, setApiCertificates] = useState<CertificateListItem[]>([]);
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

    const params = new URLSearchParams();
    if (nextKeyword.trim()) {
      params.set("q", nextKeyword.trim());
    }
    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }
    if (nextDocumentType !== "all") {
      params.set("documentType", nextDocumentType);
    }

    setIsLoadingCertificates(true);
    try {
      const url = params.toString()
        ? `${CERTIFICATES_API_URL}?${params.toString()}`
        : CERTIFICATES_API_URL;
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Không tải được danh sách bằng (${response.status}).`);
      }

      const payload = (await response.json()) as CertificatesListResponse;
      setApiCertificates(Array.isArray(payload.items) ? payload.items : []);
      setApiTotal(typeof payload.total === "number" ? payload.total : 0);
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
    const response = await fetch(`${CERTIFICATES_API_URL}/${encodeURIComponent(id)}/revoke`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `API revoke failed with status ${response.status}`);
    }

    return response.json();
  };

  const resolveBackendRevokeId = async (hash: string): Promise<string> => {
    const response = await fetch(`${CERTIFICATES_API_URL}?hash=${encodeURIComponent(hash)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return hash;
    }

    const payload = (await response.json()) as { id?: string | number };
    if (typeof payload.id === "string" && payload.id.trim()) {
      return payload.id.trim();
    }

    if (typeof payload.id === "number" && Number.isFinite(payload.id)) {
      return String(payload.id);
    }

    return hash;
  };

  const handleFilterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchCertificates();
  };

  const handleResetFilters = async () => {
    setSearchKeyword("");
    setStatusFilter("0");
    setDocumentTypeFilter("all");
    await fetchCertificates({ keyword: "", status: "0", documentType: "all" });
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
        ) : apiCertificates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Không có bản ghi nào khớp điều kiện lọc.
          </p>
        ) : (
          <div className="space-y-3">
            {apiCertificates.map((item) => (
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
