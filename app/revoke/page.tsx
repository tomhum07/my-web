"use client";

import { BrowserProvider, Contract } from "ethers";
import { FormEvent, useMemo, useState } from "react";

import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/constants/config";

type RevokedEntry = {
  id: string;
  reason: string;
  revokedAt: string;
  txHash: string;
  revokedBy: string;
};

const STORAGE_KEY = "certichain.revoked-certificates";

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
  const [entries, setEntries] = useState<RevokedEntry[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return [];
    }

    try {
      const parsed = JSON.parse(saved) as RevokedEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [message, setMessage] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);

  const isMetadataHash = (value: string) => /^0x[a-fA-F0-9]{64}$/.test(value);

  const total = useMemo(() => entries.length, [entries]);

  const persist = (nextEntries: RevokedEntry[]) => {
    setEntries(nextEntries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
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

      const nextEntries = [nextEntry, ...entries];
      persist(nextEntries);
      setCertificateId("");
      setMessage(`Đã thu hồi bằng thành công trên blockchain. Tx: ${txHash}`);
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
