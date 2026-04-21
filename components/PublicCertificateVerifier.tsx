"use client";

import { ethers } from "ethers";
import jsQR from "jsqr";
import { ChangeEvent, DragEvent, useMemo, useState } from "react";

import { CONTRACT_ABI, CONTRACT_ADDRESS, NETWORK_CONFIG } from "../constants/config";
import { decodeMetadataFromQr, hashMetadataJson } from "../utils/certificateMetadata";

type VerifyState =
  | { type: "idle"; message: string }
  | { type: "loading"; message: string }
  | {
      type: "success";
      message: string;
      studentWallet: string;
      issueDateText: string;
      expirationDateText: string;
      metadataSummary?: string;
    }
  | {
      type: "warning";
      message: string;
      studentWallet: string;
      issueDateText: string;
      expirationDateText: string;
      metadataSummary?: string;
    }
  | { type: "error"; message: string };

function isAcceptedImage(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return /\.(png|jpe?g|webp|gif|bmp|svg|avif|tiff?)$/.test(lowerName);
}

function getReadableVerifyError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("could not detect network") ||
    message.includes("missing response") ||
    message.includes("timeout")
  ) {
    return `❌ Không kết nối được RPC ${NETWORK_CONFIG.chainName}. Vui lòng kiểm tra cấu hình trong constants/config.ts.`;
  }

  return "❌ Bằng cấp không tồn tại hoặc đã bị chỉnh sửa";
}

function formatUnixTimestamp(seconds: bigint): string {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) {
    return "Không giới hạn";
  }

  const date = new Date(value * 1000);
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long",
  }).format(date);
}

function isCertificateExpired(expirationDate: bigint): boolean {
  if (expirationDate === BigInt(0)) {
    return false;
  }

  const nowInSeconds = BigInt(Math.floor(Date.now() / 1000));
  return expirationDate < nowInSeconds;
}

function readQrFromImageData(imageData: ImageData): string | null {
  const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });

  return qrResult?.data ?? null;
}

function readQrFromCanvasRegion(
  sourceCanvas: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  upscale = 1
): string | null {
  const workingCanvas = document.createElement("canvas");
  workingCanvas.width = Math.max(1, Math.floor(sw * upscale));
  workingCanvas.height = Math.max(1, Math.floor(sh * upscale));

  const workingContext = workingCanvas.getContext("2d");
  if (!workingContext) {
    return null;
  }

  workingContext.drawImage(
    sourceCanvas,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    workingCanvas.width,
    workingCanvas.height
  );

  const regionData = workingContext.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
  return readQrFromImageData(regionData);
}

async function readQrPayloadFromImage(file: File): Promise<string | null> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Khong the doc anh de quet QR."));
      image.src = objectUrl;
    });

    const maxDimension = 2200;
    const scale = Math.min(1, maxDimension / Math.max(imageElement.width, imageElement.height));
    const width = Math.max(1, Math.floor(imageElement.width * scale));
    const height = Math.max(1, Math.floor(imageElement.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Khong the khoi tao bo doc QR.");
    }

    context.drawImage(imageElement, 0, 0, width, height);
    const fullImageData = context.getImageData(0, 0, width, height);
    const fullResult = readQrFromImageData(fullImageData);
    if (fullResult) {
      return fullResult;
    }

    const attempts: Array<{ sx: number; sy: number; sw: number; sh: number; upscale: number }> = [
      { sx: 0, sy: Math.floor(height * 0.5), sw: Math.floor(width * 0.5), sh: Math.floor(height * 0.5), upscale: 2 },
      { sx: 0, sy: Math.floor(height * 0.58), sw: Math.floor(width * 0.46), sh: Math.floor(height * 0.42), upscale: 2.4 },
      { sx: 0, sy: Math.floor(height * 0.42), sw: Math.floor(width * 0.6), sh: Math.floor(height * 0.58), upscale: 1.8 },
    ];

    for (const attempt of attempts) {
      const result = readQrFromCanvasRegion(
        canvas,
        attempt.sx,
        attempt.sy,
        attempt.sw,
        attempt.sh,
        attempt.upscale
      );
      if (result) {
        return result;
      }
    }

    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function summarizeMetadata(metadataJson: string): string {
  try {
    const parsed = JSON.parse(metadataJson) as {
      studentName?: string;
      documentType?: string;
      issueDateIso?: string;
      certificateCode?: string;
    };

    const documentTypeLabels: Record<string, string> = {
      commendation: "Giấy khen",
      diploma: "Bằng tốt nghiệp",
      certificate: "Giấy chứng nhận",
    };

    const pieces = [
      parsed.studentName ? `Sinh viên: ${parsed.studentName}` : "",
      parsed.documentType ? `Loại: ${documentTypeLabels[parsed.documentType] ?? parsed.documentType}` : "",
      parsed.certificateCode ? `Mã: ${parsed.certificateCode}` : "",
    ].filter(Boolean);

    return pieces.join("\n");
  } catch {
    return "Metadata từ QR hợp lệ.";
  }
}

export default function PublicCertificateVerifier() {
  const [verifyState, setVerifyState] = useState<VerifyState>({
    type: "idle",
    message: "Tải ảnh bằng cấp (.png, .jpg, .jpeg, .webp, ...), sau đó bấm 'Kiểm tra bằng'.",
  });
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");

  const provider = useMemo(() => {
    return new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
  }, []);

  const processFile = async (file: File) => {
    if (!isAcceptedImage(file)) {
      setVerifyState({
        type: "error",
        message: "Chỉ chấp nhận file ảnh (.png, .jpg, .jpeg, .webp, .gif, .bmp, .svg, .avif, .tif, .tiff).",
      });
      return;
    }

    setSelectedFileName(file.name);
    setVerifyState({ type: "loading", message: "Đang đọc QR metadata và xác minh..." });

    try {
      const qrPayload = await readQrPayloadFromImage(file);

      let hashToVerify: string;
      let metadataSummary = "";

      if (qrPayload) {
        const metadataJson = decodeMetadataFromQr(qrPayload);
        hashToVerify = hashMetadataJson(metadataJson);
        metadataSummary = summarizeMetadata(metadataJson);
      } else {
        setVerifyState({
          type: "error",
          message: "❌ Không đọc được QR metadata từ ảnh này. Vui lòng dùng ảnh gốc vừa tải xuống từ hệ thống.",
        });
        return;
      }

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      let result: [boolean, string, bigint, bigint];
      try {
        result = (await contract.verifyCertificate(hashToVerify)) as [boolean, string, bigint, bigint];
      } catch (verifyError) {
        setVerifyState({
          type: "error",
          message: getReadableVerifyError(verifyError),
        });
        return;
      }

      const [isValid, studentWallet, issueDate, expirationDate] = result;

      if (!studentWallet || studentWallet === ethers.ZeroAddress || issueDate === BigInt(0)) {
        setVerifyState({
          type: "error",
          message: "❌ Bằng cấp không tồn tại hoặc đã bị chỉnh sửa",
        });
        return;
      }

      if (!isValid) {
        setVerifyState({
          type: "error",
          message: "❌ Bằng cấp này đã bị nhà trường thu hồi",
        });
        return;
      }

      if (isCertificateExpired(expirationDate)) {
        setVerifyState({
          type: "warning",
          message: "⚠️ Bằng cấp đã hết hạn",
          studentWallet,
          issueDateText: formatUnixTimestamp(issueDate),
          expirationDateText: formatUnixTimestamp(expirationDate),
          metadataSummary,
        });
        return;
      }

      setVerifyState({
        type: "success",
        message: "✅ Bằng cấp hợp lệ",
        studentWallet,
        issueDateText: formatUnixTimestamp(issueDate),
        expirationDateText: formatUnixTimestamp(expirationDate),
        metadataSummary,
      });
    } catch (error) {
      setVerifyState({
        type: "error",
        message: getReadableVerifyError(error),
      });
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!isAcceptedImage(file)) {
      setSelectedFile(null);
      setSelectedFileName(file.name);
      setVerifyState({
        type: "error",
        message: "Chỉ chấp nhận file ảnh (.png, .jpg, .jpeg, .webp, .gif, .bmp, .svg, .avif, .tif, .tiff).",
      });
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
    setVerifyState({
      type: "idle",
      message: "Ảnh đã sẵn sàng. Bấm 'Kiểm tra bằng' để xác thực.",
    });
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    if (!isAcceptedImage(file)) {
      setSelectedFile(null);
      setSelectedFileName(file.name);
      setVerifyState({
        type: "error",
        message: "Chỉ chấp nhận file ảnh (.png, .jpg, .jpeg, .webp, .gif, .bmp, .svg, .avif, .tif, .tiff).",
      });
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
    setVerifyState({
      type: "idle",
      message: "Ảnh đã sẵn sàng. Bấm 'Kiểm tra bằng' để xác thực.",
    });
  };

  const handleVerifyClick = async () => {
    if (!selectedFile) {
      setVerifyState({
        type: "error",
        message: "Vui lòng tải một file ảnh trước khi kiểm tra.",
      });
      return;
    }

    await processFile(selectedFile);
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 lg:py-14">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-sky-50 via-blue-50 to-slate-100 px-6 py-10 shadow-sm sm:px-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Xác thực Bằng cấp / Chứng chỉ
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Tải ảnh bằng cấp (PNG/JPG/JPEG/WEBP/...) rồi bấm nút kiểm tra để xác định bằng thật hay giả và còn hạn hay đã hết hạn trên mạng {NETWORK_CONFIG.chainName}.
        </p>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <label
          htmlFor="certificate-upload"
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center shadow-sm transition ${
            dragOver
              ? "border-emerald-400 bg-emerald-50"
              : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50"
          }`}
        >
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            Image files
          </span>
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
            Kéo thả ảnh vào đây
          </h2>
          <p className="text-sm text-slate-600">hoặc bấm để chọn file từ thiết bị</p>
          <span className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-blue-700">
            Chọn ảnh bằng cấp
          </span>
          <input
            id="certificate-upload"
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.avif,.tif,.tiff"
            className="sr-only"
            onChange={handleFileInput}
          />
        </label>

        <button
          type="button"
          onClick={handleVerifyClick}
          disabled={!selectedFile || verifyState.type === "loading"}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verifyState.type === "loading" ? "Đang kiểm tra..." : "Kiểm tra bằng"}
        </button>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Kết quả xác thực</h3>
          {selectedFileName && (
            <p className="mt-1 text-sm text-slate-500">Tệp đã chọn: {selectedFileName}</p>
          )}

          {verifyState.type === "idle" && (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {verifyState.message}
            </p>
          )}

          {verifyState.type === "loading" && (
            <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
              {verifyState.message}
            </p>
          )}

          {verifyState.type === "error" && (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
              {verifyState.message}
            </p>
          )}

          {verifyState.type === "warning" && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">{verifyState.message}</p>
              <div className="mt-3 space-y-3 leading-6">
                {verifyState.metadataSummary && (
                  verifyState.metadataSummary
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => <p key={line}>{line}</p>)
                )}
                <p className="break-all">Ví sinh viên: {verifyState.studentWallet}</p>
                <p>Ngày cấp: {verifyState.issueDateText}</p>
                <p>Hạn sử dụng: {verifyState.expirationDateText}</p>
              </div>
            </div>
          )}

          {verifyState.type === "success" && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">{verifyState.message}</p>
              <div className="mt-3 space-y-3 leading-6">
                {verifyState.metadataSummary && (
                  verifyState.metadataSummary
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => <p key={line}>{line}</p>)
                )}
                <p className="break-all">Ví sinh viên: {verifyState.studentWallet}</p>
                <p>Ngày cấp: {verifyState.issueDateText}</p>
                <p>Hạn sử dụng: {verifyState.expirationDateText}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
