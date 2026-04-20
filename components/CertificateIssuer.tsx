"use client";

import { toPng } from "html-to-image";
import { useRef, useState } from "react";

type CertificateType = "diploma" | "award" | "certificate";

type FormData = {
  studentName: string;
  studentWallet: string;
  certificateType: CertificateType;
  // Diploma fields
  major?: string;
  issueDate?: string;
  gpa?: string;
  institution?: string;
  // Award fields
  awardReason?: string;
  awardDate?: string;
  signedBy?: string;
  // Certificate fields
  courseName?: string;
  completionDate?: string;
  proficiency?: string;
};

const certificateTypes = [
  { value: "diploma", label: "Bằng Cấp" },
  { value: "award", label: "Giấy Khen" },
  { value: "certificate", label: "Giấy Chứng Nhận" },
];

function CertificatePreview({
  data,
  previewRef,
}: {
  data: FormData;
  previewRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (data.certificateType === "diploma") {
    return (
      <div
        ref={previewRef}
        className="relative mx-auto w-full max-w-3xl bg-blue-50 shadow-2xl"
        style={{ aspectRatio: "4/3" }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(30,58,138,0.02) 35px, rgba(30,58,138,0.02) 70px)',
            pointerEvents: "none",
          }}
        />
        <div className="absolute inset-0 border-8 border-blue-900"></div>
        <div className="absolute inset-4 border-2 border-amber-500"></div>
        <div className="absolute top-6 left-6 w-12 h-12 border-t-4 border-l-4 border-amber-500"></div>
        <div className="absolute top-6 right-6 w-12 h-12 border-t-4 border-r-4 border-amber-500"></div>
        <div className="absolute bottom-6 left-6 w-12 h-12 border-b-4 border-l-4 border-amber-500"></div>
        <div className="absolute bottom-6 right-6 w-12 h-12 border-b-4 border-r-4 border-amber-500"></div>

        <div className="relative h-full flex flex-col items-center justify-center px-16 py-12 text-center">
          <div className="mb-4 text-4xl">🎓</div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-900 mb-1">
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </p>
          <p className="text-xs font-semibold text-blue-800 mb-4">
            Độc Lập - Tự Do - Hạnh Phúc
          </p>
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-blue-900 mb-1">BẰNG CẤP</h1>
            <p className="text-sm text-blue-800">{data.institution || "Trường Đại Học / Cao Đẳng"}</p>
          </div>
          <div className="mb-6 text-center">
            <p className="text-xs uppercase text-blue-700 mb-2">Được cấp cho:</p>
            <p className="text-2xl font-bold text-blue-900 border-b-2 border-blue-900 pb-1 min-w-80">
              {data.studentName || "Tên Sinh Viên"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 text-sm text-blue-900 mb-8">
            <div>
              <p className="font-semibold">Chuyên Ngành:</p>
              <p>{data.major || "..."}</p>
            </div>
            <div>
              <p className="font-semibold">GPA:</p>
              <p>{data.gpa || "..."}</p>
            </div>
          </div>
          <div className="flex justify-between gap-12 w-full">
            <div className="text-center text-xs">
              <div className="h-16 border-t-2 border-blue-900 mb-1"></div>
              <p className="font-semibold text-blue-900">Hiệu Trưởng</p>
            </div>
            <div className="text-center text-xs">
              <p className="text-blue-900 font-semibold mb-2">{data.issueDate || "Ngày Cấp"}</p>
              <div className="h-16 border-t-2 border-blue-900 mb-1"></div>
              <p className="font-semibold text-blue-900">(GIÁ TRỊ CÓ XÁC NHẬN)</p>
            </div>
          </div>
          <p className="absolute bottom-4 text-xs text-blue-700">
            CertiChain Hash: {data.studentWallet?.slice(0, 16) || "0x..."}
          </p>
        </div>
      </div>
    );
  }

  if (data.certificateType === "award") {
    return (
      <div
        ref={previewRef}
        className="relative mx-auto w-full max-w-3xl bg-white shadow-2xl"
        style={{ aspectRatio: "4/3" }}
      >
        <div className="absolute inset-0 border-8 border-red-600"></div>
        <div className="absolute inset-3 border-2 border-red-900 opacity-50"></div>
        <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-red-600"></div>
        <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-red-600"></div>
        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-red-600"></div>
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-red-600"></div>

        <div className="relative h-full flex flex-col items-center justify-center px-12 py-10 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-red-900 mb-1">
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </p>
          <p className="text-xs font-semibold text-red-800 mb-4">
            Độc Lập - Tự Do - Hạnh Phúc
          </p>
          <div className="mb-4 text-6xl">🏆</div>
          <h1 className="text-3xl font-bold text-red-800 mb-1">GIẤY KHEN THƯỞNG</h1>
          <p className="text-sm font-semibold text-red-700 mb-4">
            GHI NHẬN NHỮNG THÀNH TÍCH XUẤT SẮC
          </p>
          <div className="mb-6 text-center">
            <p className="text-xs uppercase text-red-700 font-semibold mb-1">Được trao cho:</p>
            <p className="text-2xl font-bold text-red-900 border-b-2 border-red-900 pb-1 min-w-72">
              {data.studentName || "Tên Sinh Viên"}
            </p>
          </div>
          <div className="text-sm text-red-900 mb-8 space-y-1">
            <p><span className="font-semibold">Lý do:</span> {data.awardReason || "..."}</p>
            <p><span className="font-semibold">Ngày trao:</span> {data.awardDate || "..."}</p>
            <p><span className="font-semibold">Người ký:</span> {data.signedBy || "..."}</p>
          </div>
          <div className="flex justify-center gap-16 w-full">
            <div className="text-center text-xs">
              <div className="h-20 w-24 border-t-2 border-red-900 mb-1"></div>
              <p className="font-semibold text-red-900">Chủ Tịch Hội Đồng</p>
            </div>
            <div className="text-center text-xs">
              <div className="h-20 w-24 border-t-2 border-red-900 mb-1"></div>
              <p className="font-semibold text-red-900">Người Đại Diện</p>
            </div>
          </div>
          <p className="absolute bottom-4 text-xs text-red-700">
            CertiChain ID: {data.studentWallet?.slice(0, 16) || "0x..."}
          </p>
        </div>
      </div>
    );
  }

  if (data.certificateType === "certificate") {
    return (
      <div
        ref={previewRef}
        className="relative mx-auto w-full max-w-3xl bg-gradient-to-b from-blue-50 to-cyan-50 shadow-2xl"
        style={{ aspectRatio: "4/3" }}
      >
        <div className="absolute inset-0 border-8 border-blue-900"></div>
        <div className="absolute inset-4 border-2 border-amber-500"></div>
        <div className="absolute inset-6 border border-blue-400 opacity-50"></div>
        <div className="absolute top-5 left-5 w-16 h-16 bg-gradient-to-br from-amber-400 to-transparent opacity-30"></div>
        <div className="absolute top-5 right-5 w-16 h-16 bg-gradient-to-bl from-amber-400 to-transparent opacity-30"></div>
        <div className="absolute bottom-5 left-5 w-16 h-16 bg-gradient-to-tr from-amber-400 to-transparent opacity-30"></div>
        <div className="absolute bottom-5 right-5 w-16 h-16 bg-gradient-to-tl from-amber-400 to-transparent opacity-30"></div>

        <div className="relative h-full flex flex-col items-center justify-center px-14 py-10 text-center">
          <div className="mb-4 text-5xl">⭐</div>
          <h1 className="text-3xl font-bold text-blue-900 mb-1">GIẤY CHỨNG NHẬN</h1>
          <p className="text-sm font-semibold text-blue-800 mb-1">CÓ GIÁ TRỊ PHÁP LÝ</p>
          <p className="text-xs text-blue-700 mb-5">Xác nhận hoàn thành khóa học / chương trình đào tạo</p>
          <div className="mb-6 text-center">
            <p className="text-xs uppercase text-blue-700 font-semibold mb-1">Được cấp cho:</p>
            <p className="text-2xl font-bold text-blue-900 border-b-2 border-blue-900 pb-1 min-w-72">
              {data.studentName || "Tên Sinh Viên"}
            </p>
          </div>
          <div className="text-sm text-blue-900 mb-8 space-y-2 max-w-lg">
            <div>
              <span className="font-semibold">Khóa Học:</span> {data.courseName || "..."}
            </div>
            <div>
              <span className="font-semibold">Ngày Hoàn Thành:</span> {data.completionDate || "..."}
            </div>
            <div>
              <span className="font-semibold">Trình Độ Đạt Được:</span> {data.proficiency || "..."}
            </div>
          </div>
          <div className="flex justify-between gap-12 w-full text-xs">
            <div className="text-center">
              <div className="h-16 border-t-2 border-blue-900 mb-1"></div>
              <p className="font-semibold text-blue-900">Người Cấp Chứng Chỉ</p>
            </div>
            <div className="text-center">
              <p className="text-blue-900 font-semibold mb-2">CertiChain™</p>
              <div className="h-16 border-t-2 border-blue-900 mb-1"></div>
              <p className="font-semibold text-blue-900">Ngày Ký</p>
            </div>
          </div>
          <p className="absolute bottom-4 text-xs text-blue-700">
            Blockchain Hash: {data.studentWallet?.slice(0, 16) || "0x..."}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export default function CertificateIssuer() {
  const [formData, setFormData] = useState<FormData>({
    studentName: "",
    studentWallet: "",
    certificateType: "diploma",
  });

  const previewRef = useRef<HTMLDivElement>(null);

  const sanitizeFileName = (value: string) =>
    value
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "_")
      .slice(0, 80);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCertificateTypeChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      certificateType: e.target.value as CertificateType,
      major: undefined,
      issueDate: undefined,
      gpa: undefined,
      institution: undefined,
      awardReason: undefined,
      awardDate: undefined,
      signedBy: undefined,
      courseName: undefined,
      completionDate: undefined,
      proficiency: undefined,
    }));
  };

  const saveAsImage = async () => {
    if (!previewRef.current) {
      setSaveMessage("✗ Không tìm thấy vùng xem trước để tải ảnh.");
      return;
    }

    setSaving(true);
    setSaveMessage("");

    try {
      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const timestamp = new Date().toISOString().slice(0, 10);
      const safeStudentName =
        sanitizeFileName(formData.studentName || "Certificate");
      const fileName = `${formData.certificateType}_${safeStudentName}_${timestamp}.png`;

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => {
        document.body.removeChild(link);
      }, 0);

      setSaveMessage("✓ Ảnh chứng chỉ đã được lưu thành công!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      setSaveMessage(
        "✗ Lỗi khi lưu ảnh. Vui lòng thử lại."
      );
      console.error("Error exporting certificate:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="mb-6 text-xl font-bold text-slate-900">
          Tạo Giấy Tờ
        </h2>

        <form className="grid gap-5">
          <div className="grid gap-2">
            <label
              htmlFor="certificate-type"
              className="text-sm font-semibold text-slate-800"
            >
              Loại Giấy Tờ
            </label>
            <select
              id="certificate-type"
              name="certificateType"
              value={formData.certificateType}
              onChange={handleCertificateTypeChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {certificateTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="student-name"
              className="text-sm font-semibold text-slate-800"
            >
              Tên Sinh Viên
            </label>
            <input
              id="student-name"
              type="text"
              name="studentName"
              placeholder="e.g. Nguyễn Văn A"
              value={formData.studentName}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="student-wallet"
              className="text-sm font-semibold text-slate-800"
            >
              Địa Chỉ Ví Sinh Viên
            </label>
            <input
              id="student-wallet"
              type="text"
              name="studentWallet"
              placeholder="0x..."
              value={formData.studentWallet}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {formData.certificateType === "diploma" && (
            <>
              <div className="grid gap-2">
                <label
                  htmlFor="institution"
                  className="text-sm font-semibold text-slate-800"
                >
                  Tên Trường/Tổ Chức
                </label>
                <input
                  id="institution"
                  type="text"
                  name="institution"
                  placeholder="e.g. Đại Học Quốc Gia TP.HCM"
                  value={formData.institution || ""}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="grid gap-2">
                <label
                  htmlFor="major"
                  className="text-sm font-semibold text-slate-800"
                >
                  Chuyên Ngành
                </label>
                <input
                  id="major"
                  type="text"
                  name="major"
                  placeholder="e.g. Công Nghệ Thông Tin"
                  value={formData.major || ""}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label
                    htmlFor="gpa"
                    className="text-sm font-semibold text-slate-800"
                  >
                    GPA
                  </label>
                  <input
                    id="gpa"
                    type="text"
                    name="gpa"
                    placeholder="e.g. 3.8/4.0"
                    value={formData.gpa || ""}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="issue-date"
                    className="text-sm font-semibold text-slate-800"
                  >
                    Ngày Cấp
                  </label>
                  <input
                    id="issue-date"
                    type="date"
                    name="issueDate"
                    value={formData.issueDate || ""}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </>
          )}

          {formData.certificateType === "award" && (
            <>
              <div className="grid gap-2">
                <label
                  htmlFor="award-reason"
                  className="text-sm font-semibold text-slate-800"
                >
                  Lý Do Khen Thưởng
                </label>
                <input
                  id="award-reason"
                  type="text"
                  name="awardReason"
                  placeholder="e.g. Xuất sắc trong học tập"
                  value={formData.awardReason || ""}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label
                    htmlFor="award-date"
                    className="text-sm font-semibold text-slate-800"
                  >
                    Ngày Trao
                  </label>
                  <input
                    id="award-date"
                    type="date"
                    name="awardDate"
                    value={formData.awardDate || ""}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="signed-by"
                    className="text-sm font-semibold text-slate-800"
                  >
                    Người Ký
                  </label>
                  <input
                    id="signed-by"
                    type="text"
                    name="signedBy"
                    placeholder="e.g. Hiệu Trưởng"
                    value={formData.signedBy || ""}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </>
          )}

          {formData.certificateType === "certificate" && (
            <>
              <div className="grid gap-2">
                <label
                  htmlFor="course-name"
                  className="text-sm font-semibold text-slate-800"
                >
                  Tên Khóa Học
                </label>
                <input
                  id="course-name"
                  type="text"
                  name="courseName"
                  placeholder="e.g. Blockchain Fundamentals"
                  value={formData.courseName || ""}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label
                    htmlFor="completion-date"
                    className="text-sm font-semibold text-slate-800"
                  >
                    Ngày Hoàn Thành
                  </label>
                  <input
                    id="completion-date"
                    type="date"
                    name="completionDate"
                    value={formData.completionDate || ""}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="proficiency"
                    className="text-sm font-semibold text-slate-800"
                  >
                    Trình Độ Đạt Được
                  </label>
                  <input
                    id="proficiency"
                    type="text"
                    name="proficiency"
                    placeholder="e.g. Intermediate"
                    value={formData.proficiency || ""}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </>
          )}
        </form>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={saveAsImage}
            disabled={saving}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "💾 Lưu Ảnh"}
          </button>
        </div>

        {saveMessage && (
          <div
            className={`mt-3 rounded-lg px-4 py-2 text-sm font-semibold ${
              saveMessage.includes("✓")
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {saveMessage}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="mb-4 text-xl font-bold text-slate-900">
          Xem Trước Chứng Chỉ
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Hình dưới đây là bản xem trước của chứng chỉ. Nhấn &quot;Lưu Ảnh&quot; để tải xuống dưới dạng PNG.
        </p>

        <div className="flex justify-center bg-slate-100 p-4 rounded-lg">
          <CertificatePreview data={formData} previewRef={previewRef} />
        </div>
      </div>
    </div>
  );
}
