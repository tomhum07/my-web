"use client";

import { BrowserProvider, Contract } from "ethers";
import { toPng } from "html-to-image";
import Image from "next/image";
import { Dancing_Script } from "next/font/google";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../constants/config";
import {
  CertificateMetadata,
  encodeMetadataForQr,
  hashMetadataJson,
  serializeCertificateMetadata,
} from "../utils/certificateMetadata";
import { dataUrlToBlob } from "../utils/hashUtils";

type DateInputEvent = React.ChangeEvent<HTMLInputElement>;
type DocumentType = "commendation" | "diploma" | "certificate";
type DiplomaType = "bachelor" | "engineer" | "doctor" | "master";
type CommendationGeneratorProps = {
  initialDocumentType?: DocumentType;
  disableBlockchain?: boolean;
};

const DEFAULT_ISSUE_DATE = "00 tháng 00 năm 2026";

const dancingScript = Dancing_Script({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "700"],
});

function formatIssueDate(isoDate: string) {
  if (!isoDate) return DEFAULT_ISSUE_DATE;

  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return DEFAULT_ISSUE_DATE;

  return `${day} tháng ${month} năm ${year}`;
}

function getDateInputValue(displayValue: string) {
  const match = displayValue.match(/^(\d{2}) tháng (\d{2}) năm (\d{4})$/);
  if (!match) return "";

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function formatDateSlash(isoDate: string) {
  if (!isoDate) return "__/__/____";

  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return "__/__/____";

  return `${day}/${month}/${year}`;
}

function parseIssueDateToTimestamp(displayValue: string) {
  const isoDate = getDateInputValue(displayValue);
  if (!isoDate) return null;

  const parsedDate = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return Math.floor(parsedDate.getTime() / 1000);
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    document.body.removeChild(link);
  }, 0);
}

export default function CommendationGenerator({
  initialDocumentType = "commendation",
  disableBlockchain = false,
}: CommendationGeneratorProps) {
  const [documentType, setDocumentType] = useState<DocumentType>(initialDocumentType);
  const [studentName, setStudentName] = useState("LÊ MINH TRỌNG");
  const [studentGenderLabel, setStudentGenderLabel] = useState("Ông");
  const [studentClass, setStudentClass] = useState("ĐHCNTT23A-CS");
  const [faculty, setFaculty] = useState("Công nghệ và Kỹ thuật");
  const [content, setContent] = useState("Sinh viên xuất sắc - Năm học 2024-2025");
  const [diplomaType, setDiplomaType] = useState<DiplomaType>("engineer");
  const [major, setMajor] = useState("Khoa học máy tính - Công nghệ phần mềm");
  const [dateOfBirth, setDateOfBirth] = useState("2004-02-22");
  const [graduationYear, setGraduationYear] = useState("2028");
  const [graduationRank, setGraduationRank] = useState("Xuất sắc");
  const [location, setLocation] = useState("Đồng Tháp");
  const [issueDate, setIssueDate] = useState(DEFAULT_ISSUE_DATE);
  const [expirationDate, setExpirationDate] = useState(DEFAULT_ISSUE_DATE);
  const [studentWalletAddress, setStudentWalletAddress] = useState("");
  const [isPermanent, setIsPermanent] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [certificateCode] = useState(() => {
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `CERT-${Date.now().toString(36).toUpperCase()}-${randomPart}`;
  });

  const templateMap: Record<DocumentType, { title: string; bg: string; filename: string }> = {
    commendation: {
      title: "Giấy khen",
      bg: "/phoi_giay_khen_2.png",
      filename: "giay_khen.png",
    },
    diploma: {
      title: "Bằng tốt nghiệp",
      bg: "/phoi_bang_tot_nghiep.png",
      filename: "bang_tot_nghiep.png",
    },
    certificate: {
      title: "Giấy chứng nhận",
      bg: "/phoi_giay_chung_nhan.png",
      filename: "giay_chung_nhan.png",
    },
  };

  const diplomaTypeMap: Record<DiplomaType, { label: string; showRank: boolean }> = {
    bachelor: { label: "CỬ NHÂN", showRank: true },
    engineer: { label: "KỸ SƯ", showRank: true },
    doctor: { label: "TIẾN SĨ", showRank: false },
    master: { label: "THẠC SĨ", showRank: false },
  };

  const handleIssueDateChange = (event: DateInputEvent) => {
    setIssueDate(event.target.value ? formatIssueDate(event.target.value) : DEFAULT_ISSUE_DATE);
  };

  const handleExpirationDateChange = (event: DateInputEvent) => {
    setExpirationDate(event.target.value ? formatIssueDate(event.target.value) : DEFAULT_ISSUE_DATE);
  };

  const expirationTimestamp = useMemo(() => {
    return isPermanent ? 0 : parseIssueDateToTimestamp(expirationDate) ?? 0;
  }, [expirationDate, isPermanent]);

  const certificateMetadata = useMemo<CertificateMetadata>(() => {
    return {
      version: 1,
      documentType,
      studentName,
      studentWalletAddress,
      issueDateIso: getDateInputValue(issueDate),
      expirationTimestamp,
      certificateCode,
    };
  }, [
    certificateCode,
    documentType,
    expirationTimestamp,
    issueDate,
    studentName,
    studentWalletAddress,
  ]);

  const metadataJson = useMemo(() => {
    return serializeCertificateMetadata(certificateMetadata);
  }, [certificateMetadata]);

  useEffect(() => {
    let isActive = true;

    const generateQr = async () => {
      try {
        const payload = encodeMetadataForQr(metadataJson);
        const dataUrl = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 220,
        });

        if (isActive) {
          setQrCodeDataUrl(dataUrl);
        }
      } catch {
        if (isActive) {
          setQrCodeDataUrl("");
        }
      }
    };

    void generateQr();

    return () => {
      isActive = false;
    };
  }, [metadataJson]);

  const handleDownloadImage = async () => {
    try {
      setIsDownloading(true);
      setDownloadMessage(
        disableBlockchain
          ? "Dang tao anh..."
          : "Phase 1: Capturing certificate and generating metadata hash..."
      );

      const certificateElement = document.getElementById("certificate-canvas");
      if (!certificateElement) {
        setDownloadMessage("Khong tim thay vung giay khen de tai.");
        return;
      }

      const imageUrl = await toPng(certificateElement, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });

      if (disableBlockchain) {
        const safeStudentName = sanitizeFileName(studentName || "hoc_sinh");
        const fileName = `${documentType}_${safeStudentName}.png`;
        downloadDataUrl(imageUrl, fileName);
        setDownloadMessage("Tai anh thanh cong.");
        return;
      }

      const imageBlob = dataUrlToBlob(imageUrl);
      const metadataHash = hashMetadataJson(metadataJson);
      const parsedExpiration = isPermanent ? 0 : parseIssueDateToTimestamp(expirationDate);

      if (!studentWalletAddress.trim()) {
        throw new Error("Vui long nhap dia chi vi cua hoc sinh.");
      }

      if (!isPermanent && parsedExpiration === null) {
        throw new Error("Ngay het han khong hop le.");
      }

      if (!window.ethereum) {
        throw new Error("MetaMask is not installed.");
      }

      setDownloadMessage("Phase 2: Waiting for MetaMask...");
      const browserProvider = new BrowserProvider(window.ethereum);
      await browserProvider.send("eth_requestAccounts", []);

      const signer = await browserProvider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setDownloadMessage("Phase 2: Sending transaction to blockchain...");
      const tx = await contract.issueCertificate(
        metadataHash,
        studentWalletAddress.trim(),
        parsedExpiration ?? 0
      );

      setDownloadMessage("Phase 2: Waiting for transaction confirmation...");
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction was not confirmed.");
      }

      const safeStudentName = sanitizeFileName(studentName || "hoc_sinh");
      const fileName = `${documentType}_${safeStudentName}.png`;
      downloadDataUrl(imageUrl, fileName);

      setDownloadMessage("Phase 3: Uploading certificate to backend...");

      const imageFile = new File([imageBlob], templateMap[documentType].filename, {
        type: imageBlob.type || "image/png",
      });

      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("studentName", studentName);
      formData.append("studentWalletAddress", studentWalletAddress.trim());
      formData.append("imageHash", metadataHash);
      formData.append("documentType", documentType);
      formData.append("expirationTimestamp", String(parsedExpiration ?? 0));
      formData.append("metadataJson", metadataJson);

      try {
        const response = await fetch("/api/certificates", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn("Backend upload failed:", errorText || response.statusText);
          setDownloadMessage(
            "Da phat hanh tren blockchain va tai anh thanh cong. Khong the dong bo backend."
          );
          return;
        }

        setDownloadMessage("Hoan thanh: chung chi da duoc phat hanh, tai anh va dong bo thanh cong.");
        window.alert("Chung chi da duoc phat hanh va tai anh thanh cong.");
      } catch (uploadError) {
        console.warn("Backend upload request failed:", uploadError);
        setDownloadMessage(
          "Da phat hanh tren blockchain va tai anh thanh cong. Khong the dong bo backend."
        );
      }
    } catch (error) {
      console.error("Download failed:", error);
      const message = error instanceof Error ? error.message : "Tai anh that bai. Vui long thu lai.";
      setDownloadMessage(message);
      window.alert(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-8 sm:px-6 lg:px-8"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      <div className="mx-auto max-w-[1700px]">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            Certificate Studio
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Cấp giấy tờ
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Cấp giấy khen, bằng tốt nghiệp hoặc giấy chứng nhận với bản xem trước trực tiếp.
          </p>
        </header>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Control Panel</h2>
              <p className="mt-1 text-sm text-slate-600">
                Chỉnh sửa thông tin bên dưới để cập nhật bản xem trước ngay lập tức.
              </p>
            </div>

            <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
              <div className="grid gap-2 xl:col-span-3">
                <label htmlFor="document-type" className="text-sm font-semibold text-slate-800">
                  Loại giấy tờ
                </label>
                <select
                  id="document-type"
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value as DocumentType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                >
                  <option value="commendation">Giấy khen</option>
                  <option value="diploma">Bằng tốt nghiệp</option>
                  <option value="certificate">Giấy chứng nhận</option>
                </select>
              </div>

              <div className="grid gap-2 xl:col-span-3">
                <label htmlFor="student-name" className="text-sm font-semibold text-slate-800">
                  Họ và tên
                </label>
                <input
                  id="student-name"
                  type="text"
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="grid gap-2 xl:col-span-4">
                <label htmlFor="student-wallet" className="text-sm font-semibold text-slate-800">
                  Địa chỉ ví học sinh
                </label>
                <input
                  id="student-wallet"
                  type="text"
                  value={studentWalletAddress}
                  onChange={(event) => setStudentWalletAddress(event.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="grid gap-2 xl:col-span-2">
                <label htmlFor="student-gender" className="text-sm font-semibold text-slate-800">
                  Danh xưng
                </label>
                <select
                  id="student-gender"
                  value={studentGenderLabel}
                  onChange={(event) => setStudentGenderLabel(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                >
                  <option value="Ông">Ông</option>
                  <option value="Bà">Bà</option>
                  <option value="Anh/Chị">Anh/Chị</option>
                </select>
              </div>

              <div className="grid gap-2 xl:col-span-2">
                <label htmlFor="student-class" className="text-sm font-semibold text-slate-800">
                  Lớp
                </label>
                <input
                  id="student-class"
                  type="text"
                  value={studentClass}
                  onChange={(event) => setStudentClass(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="grid gap-2 xl:col-span-3">
                <label htmlFor="faculty" className="text-sm font-semibold text-slate-800">
                  Khoa / Ngành
                </label>
                <input
                  id="faculty"
                  type="text"
                  value={faculty}
                  onChange={(event) => setFaculty(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              {documentType !== "diploma" && (
                <div className="grid gap-2 xl:col-span-4">
                  <label htmlFor="content" className="text-sm font-semibold text-slate-800">
                    Nội dung
                  </label>
                  <input
                    id="content"
                    type="text"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Ví dụ: Sinh viên xuất sắc - Năm học 2024-2025"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              )}

              {documentType === "diploma" && (
                <>
                  <div className="grid gap-2 xl:col-span-2">
                    <label htmlFor="diploma-type" className="text-sm font-semibold text-slate-800">
                      Loại bằng
                    </label>
                    <select
                      id="diploma-type"
                      value={diplomaType}
                      onChange={(event) => setDiplomaType(event.target.value as DiplomaType)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    >
                      <option value="bachelor">Bằng cử nhân</option>
                      <option value="engineer">Bằng kỹ sư</option>
                      <option value="doctor">Bằng tiến sĩ</option>
                      <option value="master">Bằng thạc sĩ</option>
                    </select>
                  </div>

                  <div className="grid gap-2 xl:col-span-4">
                    <label htmlFor="major" className="text-sm font-semibold text-slate-800">
                      Chuyên ngành
                    </label>
                    <input
                      id="major"
                      type="text"
                      value={major}
                      onChange={(event) => setMajor(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    />
                  </div>

                  <div className="grid gap-2 xl:col-span-2">
                    <label htmlFor="date-of-birth" className="text-sm font-semibold text-slate-800">
                      Ngày sinh
                    </label>
                    <input
                      id="date-of-birth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(event) => setDateOfBirth(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    />
                  </div>

                  <div className="grid gap-2 xl:col-span-2">
                    <label htmlFor="graduation-year" className="text-sm font-semibold text-slate-800">
                      Năm tốt nghiệp
                    </label>
                    <input
                      id="graduation-year"
                      type="text"
                      value={graduationYear}
                      onChange={(event) => setGraduationYear(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                    />
                  </div>

                  {diplomaTypeMap[diplomaType].showRank && (
                    <div className="grid gap-2 xl:col-span-2">
                      <label htmlFor="graduation-rank" className="text-sm font-semibold text-slate-800">
                        Xếp loại
                      </label>
                      <input
                        id="graduation-rank"
                        type="text"
                        value={graduationRank}
                        onChange={(event) => setGraduationRank(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="grid gap-2 xl:col-span-2">
                <label htmlFor="location" className="text-sm font-semibold text-slate-800">
                  Địa điểm
                </label>
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="grid gap-2 xl:col-span-2">
                <label htmlFor="issue-date" className="text-sm font-semibold text-slate-800">
                  Ngày cấp
                </label>
                <input
                  id="issue-date"
                  type="date"
                  value={getDateInputValue(issueDate)}
                  onChange={handleIssueDateChange}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="grid gap-2 xl:col-span-2">
                <label htmlFor="expiration-date" className="text-sm font-semibold text-slate-800">
                  Ngày hết hạn
                </label>
                <input
                  id="expiration-date"
                  type="date"
                  value={getDateInputValue(expirationDate)}
                  onChange={handleExpirationDateChange}
                  disabled={isPermanent}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              <div className="grid gap-2 xl:col-span-2">
                <label className="text-sm font-semibold text-slate-800">Trạng thái</label>
                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900">
                  <input
                    type="checkbox"
                    checked={isPermanent}
                    onChange={(event) => {
                      setIsPermanent(event.target.checked);
                      if (event.target.checked) {
                        setExpirationDate(DEFAULT_ISSUE_DATE);
                      }
                    }}
                    className="h-4 w-4 accent-sky-700"
                  />
                  Chứng chỉ vĩnh viễn
                </label>
              </div>

              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isDownloading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2 xl:col-span-5"
              >
                {isDownloading ? "Waiting..." : disableBlockchain ? "Tai anh xuong" : "Issue Certificate"}
              </button>

              {downloadMessage && (
                <p className="text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-12">{downloadMessage}</p>
              )}
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Certificate Preview</h2>
              <p className="mt-1 text-sm text-slate-600">
                Đang xem trước: {templateMap[documentType].title}.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl bg-slate-100 p-1 sm:p-2">
              <div
                id="certificate-canvas"
                className="relative mx-auto aspect-[1.414/1] w-full max-w-[1500px] overflow-hidden rounded-xl bg-center bg-no-repeat shadow-lg"
                style={{
                  backgroundImage: `url("${templateMap[documentType].bg}")`,
                  backgroundSize: "100% 100%",
                }}
              >
                {documentType === "commendation" && (
                  <>
                    <div className="pointer-events-none absolute left-1/2 top-[54%] z-10 w-[44%] -translate-x-1/2 whitespace-normal break-words text-center text-[16px] leading-tight text-black sm:text-[24px]">
                      <span className="mr-2 text-[12px] sm:text-[18px]">Sinh viên</span>
                      <span className={dancingScript.className}>{studentName || "LÊ MINH TRỌNG"}</span>
                    </div>

                    <div className="pointer-events-none absolute left-1/2 top-[59.6%] z-10 w-[58%] -translate-x-1/2 whitespace-normal break-words text-center text-[10px] leading-tight text-black sm:text-[14px]">
                      <span className="block">
                        Lớp {studentClass || "ĐHCNTT23A-CS"} - Khoa {faculty || "Công nghệ và Kỹ thuật"}
                      </span>
                    </div>

                    <div className="pointer-events-none absolute left-1/2 top-[63%] z-10 w-[60%] -translate-x-1/2 whitespace-normal break-words text-center text-[10px] leading-tight text-black sm:text-[14px]">
                      <span className="block">{content || "Sinh viên xuất sắc - Năm học 2024-2025"}</span>
                    </div>
                  </>
                )}

                {documentType === "certificate" && (
                  <>
                    <div className="pointer-events-none absolute left-1/2 top-[51%] z-10 w-[40%] -translate-x-1/2 whitespace-normal break-words text-center text-[14px] font-bold leading-tight text-black sm:text-[22px]">
                      <span className="block">{content || "Hoàn thành xuất sắc công tác Đoàn, Hội năm học 2025-2026"}</span>
                    </div>

                    <div className="pointer-events-none absolute left-1/2 top-[60%] z-10 w-[58%] -translate-x-1/2 whitespace-normal break-words text-center leading-tight text-black">
                      <span className="mr-2 text-[11px] text-black sm:text-[18px]">Cho sinh viên</span>
                      <span className={`${dancingScript.className} text-[14px] font-bold sm:text-[24px]`}>
                        {studentName || "LÊ MINH TRỌNG"}
                      </span>
                    </div>

                    <div className="pointer-events-none absolute left-1/2 top-[66%] z-10 w-[62%] -translate-x-1/2 whitespace-normal break-words text-center text-[10px] leading-tight text-black sm:text-[16px]">
                      <span className="block">
                        Lớp {studentClass || "ĐHCNTT23A-CS"} - Khoa {faculty || "Công nghệ và Kỹ thuật"}
                      </span>
                    </div>
                  </>
                )}

                {documentType === "diploma" && (
                  <>
                    <div className="pointer-events-none absolute left-1/2 top-[36%] z-10 w-[56%] -translate-x-1/2 whitespace-normal break-words text-center text-[14px] font-bold leading-tight text-red-600 sm:text-[32px]">
                      <span className="block">BẰNG {diplomaTypeMap[diplomaType].label}</span>
                    </div>

                    <div className="pointer-events-none absolute left-1/2 top-[44.5%] z-10 w-[62%] -translate-x-1/2 whitespace-normal break-words text-center text-[11px] leading-tight text-black sm:text-[24px]">
                      <span className="block">{major || "Khoa học máy tính - Công nghệ phần mềm"}</span>
                    </div>

                    <div className="pointer-events-none absolute left-[33%] top-[50%] z-10 w-[54%] whitespace-normal break-words text-left text-[10px] leading-tight text-black sm:text-[18px]">
                      <span className="mb-1 block">Cho: {studentGenderLabel} {studentName || "LÊ MINH TRỌNG"}</span>
                      <span className="mb-1 block">Ngày sinh: {formatDateSlash(dateOfBirth)}</span>
                      <span className="mb-1 block">Năm tốt nghiệp: {graduationYear || "2028"}</span>
                      {diplomaTypeMap[diplomaType].showRank && (
                        <span className="block">Xếp loại tốt nghiệp: {graduationRank || "Xuất sắc"}</span>
                      )}
                    </div>
                  </>
                )}

                <div className="pointer-events-none absolute right-[25%] top-[70%] z-10 w-[26%] whitespace-normal break-words text-right text-[9px] italic leading-tight text-black sm:text-[12px]">
                  {(location || "Đồng Tháp") + ", ngày " + (issueDate || DEFAULT_ISSUE_DATE)}
                </div>

                {qrCodeDataUrl && (
                  <div className="pointer-events-none absolute bottom-[9.3%] left-[6.1%] z-10">
                    <Image
                      src={qrCodeDataUrl}
                      alt="Certificate metadata QR"
                      width={74}
                      height={74}
                      unoptimized
                      className="h-[46px] w-[46px] sm:h-[74px] sm:w-[74px]"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
