"use client";

import { toPng } from "html-to-image";
import { useRef, useState } from "react";

type TemplateType = 1 | 2;

export default function CertificateGenerator() {
  const [templateId, setTemplateId] = useState<TemplateType>(1);
  const [studentName, setStudentName] = useState("");
  const [achievement, setAchievement] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");

  const previewRef = useRef<HTMLDivElement>(null);

  const sanitizeFileName = (value: string) =>
    value
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "_")
      .slice(0, 80);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTemplateId(parseInt(e.target.value) as TemplateType);
  };

  const handleStudentNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStudentName(e.target.value);
  };

  const handleAchievementChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setAchievement(e.target.value);
  };

  const handleIssueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIssueDate(e.target.value);
  };

  const handleIssuerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIssuerName(e.target.value);
  };

  const handleDownloadImage = async () => {
    try {
      setIsDownloading(true);
      setDownloadMessage("");

      // Select the certificate canvas element
      const certificateElement = document.getElementById("certificate-canvas");
      if (!certificateElement) {
        setDownloadMessage("❌ Không tìm thấy vùng chứng chỉ để tải ảnh.");
        setIsDownloading(false);
        return;
      }

      // Render element to canvas with high resolution
      const dataUrl = await toPng(certificateElement, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      const safeName = sanitizeFileName(studentName || "certificate");
      const fileName = `certificate_${templateId === 1 ? "giaykhen" : "modern"}_${safeName}.png`;
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => {
        document.body.removeChild(link);
      }, 0);

      setDownloadMessage("✓ Ảnh chứng chỉ đã tải xuống thành công!");
      setTimeout(() => setDownloadMessage(""), 3000);
    } catch (error) {
      console.error("Error downloading image:", error);
      setDownloadMessage("❌ Lỗi khi tải ảnh. Vui lòng thử lại.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Certificate Generator
          </h1>
          <p className="mt-2 text-slate-600">
            Create professional certificates with live preview
          </p>
        </div>

        {/* Main Layout - Two Columns */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Control Panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-slate-900">
              Control Panel
            </h2>

            <form className="space-y-5">
              {/* Template Selection */}
              <div className="grid gap-2">
                <label
                  htmlFor="template-select"
                  className="text-sm font-semibold text-slate-800"
                >
                  Select Template
                </label>
                <select
                  id="template-select"
                  value={templateId}
                  onChange={handleTemplateChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value={1}>Template 1: Giấy Khen Truyền Thống</option>
                  <option value={2}>Template 2: Modern Certificate</option>
                </select>
              </div>

              {/* Student Name */}
              <div className="grid gap-2">
                <label
                  htmlFor="student-name"
                  className="text-sm font-semibold text-slate-800"
                >
                  Student Name
                </label>
                <input
                  id="student-name"
                  type="text"
                  placeholder="Enter student name"
                  value={studentName}
                  onChange={handleStudentNameChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {/* Achievement */}
              <div className="grid gap-2">
                <label
                  htmlFor="achievement"
                  className="text-sm font-semibold text-slate-800"
                >
                  Achievement / Reason
                </label>
                <textarea
                  id="achievement"
                  placeholder="Describe the achievement or reason for the award..."
                  value={achievement}
                  onChange={handleAchievementChange}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {/* Issue Date */}
              <div className="grid gap-2">
                <label
                  htmlFor="issue-date"
                  className="text-sm font-semibold text-slate-800"
                >
                  Issue Date
                </label>
                <input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={handleIssueDateChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {/* Issuer Name */}
              <div className="grid gap-2">
                <label
                  htmlFor="issuer-name"
                  className="text-sm font-semibold text-slate-800"
                >
                  Issuer / Authorized By
                </label>
                <input
                  id="issuer-name"
                  type="text"
                  placeholder="Enter issuer name or title"
                  value={issuerName}
                  onChange={handleIssuerNameChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {/* Info Banner */}
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 border border-blue-200">
                <p className="font-semibold mb-1">Pro Tip:</p>
                <p>Fill in all fields to see the live preview on the right side.</p>
              </div>

              {/* Download Button */}
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isDownloading}
                className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDownloading ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Đang tải...
                  </>
                ) : (
                  <>
                    📥 Tải Ảnh Xuống
                  </>
                )}
              </button>

              {/* Download Status Message */}
              {downloadMessage && (
                <div
                  className={`rounded-lg p-3 text-sm font-semibold ${
                    downloadMessage.includes("✓")
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : "bg-red-100 text-red-800 border border-red-200"
                  }`}
                >
                  {downloadMessage}
                </div>
              )}
              </form>
          </div>

          {/* Right Column - Live Preview Area */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-slate-900">
              Live Preview
            </h2>

            {/* Certificate Canvas - A4 Landscape Ratio */}
            <div
              id="certificate-canvas"
              className="relative mx-auto w-full bg-slate-100 flex items-center justify-center rounded-lg overflow-hidden"
              style={{ aspectRatio: "1.414 / 1" }}
            >
              {templateId === 1 ? (
                // Template 1: Giấy Khen Traditional
                <div
                  ref={previewRef}
                  className="relative w-full h-full bg-white flex flex-col items-center justify-center p-12 text-center"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(220,38,38,0.02) 35px, rgba(220,38,38,0.02) 70px)',
                  }}
                >
                  {/* Outer Red Border */}
                  <div className="absolute inset-0 border-8 border-red-600 pointer-events-none"></div>

                  {/* Inner Border */}
                  <div className="absolute inset-4 border-2 border-red-900 opacity-40 pointer-events-none"></div>

                  {/* Corner Decorations */}
                  <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-red-600"></div>
                  <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-red-600"></div>
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-red-600"></div>
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-red-600"></div>

                  {/* Content */}
                  <div className="relative z-10 w-full">
                    <p className="text-xs font-bold uppercase tracking-widest text-red-900 mb-1">
                      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </p>
                    <p className="text-xs font-semibold text-red-800 mb-6">
                      Độc Lập - Tự Do - Hạnh Phúc
                    </p>

                    {/* Trophy Icon */}
                    <div className="mb-6 text-5xl">🏆</div>

                    {/* Main Title */}
                    <h1 className="text-4xl font-bold text-red-700 mb-2">
                      GIẤY KHEN
                    </h1>
                    <p className="text-xs text-red-700 mb-8 font-semibold">
                      GHI NHẬN NHỮNG THÀNH TÍCH XUẤT SẮC
                    </p>

                    {/* Student Name Section */}
                    <div className="mb-8">
                      <p className="text-xs uppercase text-red-700 font-semibold mb-2">
                        Được trao cho:
                      </p>
                      <p className="text-3xl font-bold text-red-900 border-b-2 border-red-900 pb-3 min-h-12">
                        {studentName || "Tên Sinh Viên"}
                      </p>
                    </div>

                    {/* Achievement Details */}
                    <div className="text-xs text-red-900 mb-8 space-y-2">
                      {achievement && (
                        <p>
                          <span className="font-semibold">Lý do khen thưởng:</span>{" "}
                          <span className="block mt-1 italic">{achievement}</span>
                        </p>
                      )}
                      {issueDate && (
                        <p>
                          <span className="font-semibold">Ngày trao:</span>{" "}
                          {issueDate}
                        </p>
                      )}
                    </div>

                    {/* Signature Section */}
                    <div className="flex justify-between gap-8 mt-8">
                      <div className="text-center text-xs flex-1">
                        <div className="h-12 border-t-2 border-red-900 mb-1"></div>
                        <p className="font-semibold text-red-900">
                          {issuerName || "Chữ Ký Người Đại Diện"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Template 2: Modern Certificate
                <div
                  ref={previewRef}
                  className="relative w-full h-full bg-gradient-to-br from-blue-50 via-blue-100 to-cyan-50 flex flex-col items-center justify-center p-12 text-center"
                >
                  {/* Navy Outer Border */}
                  <div className="absolute inset-0 border-8 border-blue-900 pointer-events-none"></div>

                  {/* Gold Middle Border */}
                  <div className="absolute inset-4 border-3 border-amber-500 pointer-events-none"></div>

                  {/* Inner Light Border */}
                  <div className="absolute inset-6 border border-blue-300 pointer-events-none opacity-50"></div>

                  {/* Corner Gold Accents */}
                  <div className="absolute top-5 left-5 w-10 h-10 border-t-4 border-l-4 border-amber-500"></div>
                  <div className="absolute top-5 right-5 w-10 h-10 border-t-4 border-r-4 border-amber-500"></div>
                  <div className="absolute bottom-5 left-5 w-10 h-10 border-b-4 border-l-4 border-amber-500"></div>
                  <div className="absolute bottom-5 right-5 w-10 h-10 border-b-4 border-r-4 border-amber-500"></div>

                  {/* Content */}
                  <div className="relative z-10 w-full flex flex-col items-center">
                    {/* Star Icon */}
                    <div className="mb-6 text-5xl">⭐</div>

                    {/* Main Title */}
                    <h1 className="text-3xl font-bold text-blue-900 mb-2">
                      CERTIFICATE OF APPRECIATION
                    </h1>

                    {/* Subtitle */}
                    <p className="text-sm font-semibold text-blue-800 mb-6 border-b-2 border-amber-500 pb-2 w-48">
                      This certifies that
                    </p>

                    {/* Student Name */}
                    <div className="mb-8">
                      <p className="text-3xl font-bold text-blue-900 border-b-2 border-blue-900 pb-3 min-h-12">
                        {studentName || "Name Here"}
                      </p>
                    </div>

                    {/* Achievement Text */}
                    <div className="text-sm text-blue-900 mb-8 max-w-md">
                      <p className="text-xs uppercase font-semibold mb-3 text-amber-600">
                        Has successfully demonstrated excellence in:
                      </p>
                      <p className="italic min-h-16 flex items-center justify-center leading-relaxed">
                        {achievement || "Outstanding achievement and dedication"}
                      </p>
                    </div>

                    {/* Date and Issuer */}
                    <div className="text-xs text-blue-700 mb-8 space-y-1">
                      {issueDate && (
                        <p>
                          <span className="font-semibold">Date:</span> {issueDate}
                        </p>
                      )}
                    </div>

                    {/* Signature Section */}
                    <div className="flex justify-center gap-16 mt-8">
                      <div className="text-center text-xs">
                        <div className="h-12 w-24 border-t-2 border-blue-900 mb-2"></div>
                        <p className="font-semibold text-blue-900">
                          {issuerName || "Authorized Signature"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-4 text-xs text-slate-500">
              A4 Landscape · Updates in real-time as you modify the form
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
