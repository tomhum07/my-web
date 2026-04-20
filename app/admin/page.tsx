"use client";

import CommendationGenerator from "@/components/CommendationGenerator";

export default function AdminPage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 lg:py-14">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          Admin Panel
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Commendation Issuance Dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
          Tạo giấy khen theo phôi mới, chỉnh thông tin trực tiếp và tải ảnh PNG.
        </p>
      </header>

      <CommendationGenerator />
    </section>
  );
}