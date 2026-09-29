"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { api } from "@/lib/api";

export default function SellPage() {
  function toLocalDatetime(date: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function toLocalDatetimeFromISO(isoString: string) {
    const date = new Date(isoString);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function getDefaultTimes() {
    const now = new Date();
    const later = new Date(now.getTime() + 24 * 3600_000);
    return { startTime: toLocalDatetime(now), endTime: toLocalDatetime(later) };
  }

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    title: "",
    description: "",
    selectedCategories: [] as string[],
    customCategory: "",
    startingPrice: "",
    minIncrement: "",
    ...getDefaultTimes(),
  }));
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customCategoryRef = useRef<HTMLInputElement>(null);

  const parsedCustomCategories = form.customCategory
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const baseSelectedCategoryNames = form.selectedCategories.filter((c) => c !== "__custom");
  const displayCustomCategories = form.selectedCategories.includes("__custom")
    ? parsedCustomCategories.filter((item) => !baseSelectedCategoryNames.includes(item))
    : [];
  const selectedDisplayCategories = [...new Set([...baseSelectedCategoryNames, ...displayCustomCategories])].join(", ");

  function handleConfirmCustomCategories() {
    const hasNonCustomCategory = form.selectedCategories.some((c) => c !== "__custom");
    const customSelected = form.selectedCategories.includes("__custom");
    if (form.selectedCategories.length === 0) return;
    if (!hasNonCustomCategory && customSelected && parsedCustomCategories.length === 0) return;

    setForm((prev) => {
      if (customSelected) {
        const currentCustom = prev.selectedCategories.filter((c) => c !== "__custom");
        const nextCustom = [...new Set([...currentCustom, ...parsedCustomCategories])];
        return {
          ...prev,
          selectedCategories: [...nextCustom, "__custom"],
          customCategory: parsedCustomCategories.join(", "),
        };
      }
      return prev;
    });

    setCategoryOpen(false);
  }

  useEffect(() => {
    api.getCategories()
      .then(setCategories)
      .catch(console.error);
  }, []);

  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  useEffect(() => {
    if (form.selectedCategories.includes("__custom")) {
      customCategoryRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [form.selectedCategories]);

  // Edit mode: load auction data
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auctionId = params.get("edit");
    if (!auctionId) return;
    const confirmedAuctionId: string = auctionId;

    async function loadEditAuction() {
      setEditId(confirmedAuctionId);
      setEditLoading(true);
      try {
        const data = await api.getAuction(confirmedAuctionId);
        setForm({
          title: data.title,
          description: data.description,
          selectedCategories: data.categories || [],
          customCategory: "",
          startingPrice: formatNumberInput(String(data.startingPrice)),
          minIncrement: formatNumberInput(String(data.minIncrement)),
          startTime: toLocalDatetimeFromISO(data.startTime),
          endTime: toLocalDatetimeFromISO(data.endTime),
        });
        if (data.images && data.images.length > 0) {
          setExistingImages(data.images);
        } else if (data.image) {
          setExistingImages([data.image]);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setEditLoading(false);
      }
    }

    void loadEditAuction();
  }, []);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Vui lòng nhập tên sản phẩm";
    if (!form.description.trim()) errs.description = "Vui lòng nhập mô tả";
    if (form.selectedCategories.length === 0 && !form.customCategory.trim()) errs.selectedCategories = "Vui lòng chọn danh mục";
    if (form.selectedCategories.includes("__custom") && !form.customCategory.trim()) errs.customCategory = "Vui lòng nhập danh mục khác";
    const rawStarting = parseFormattedNumber(form.startingPrice);
    const rawIncrement = parseFormattedNumber(form.minIncrement);
    if (!rawStarting || Number(rawStarting) <= 0) errs.startingPrice = "Giá khởi điểm phải lớn hơn 0";
    if (!rawIncrement || Number(rawIncrement) <= 0) errs.minIncrement = "Bước giá phải lớn hơn 0";
    if (Number(rawIncrement) >= Number(rawStarting)) errs.minIncrement = "Bước giá phải nhỏ hơn giá khởi điểm";
    if (!form.startTime) errs.startTime = "Vui lòng chọn thời gian bắt đầu";
    else if (!editId && new Date(form.startTime) <= new Date()) errs.startTime = "Thời gian bắt đầu phải sau thời điểm hiện tại";
    if (!form.endTime) errs.endTime = "Vui lòng chọn thời gian kết thúc";
    else if (form.startTime && new Date(form.endTime) <= new Date(form.startTime)) {
      errs.endTime = "Thời gian kết thúc phải sau thời gian bắt đầu";
    }
    return errs;
  }

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const valid = Array.from(selected).filter((f) => f.type.startsWith("image/"));
    setImageFiles((prev) => {
      const next = [...prev, ...valid].slice(0, 10);
      previews.forEach((u) => URL.revokeObjectURL(u));
      setPreviews(next.map((f) => URL.createObjectURL(f)));
      return next;
    });
  }

  function removeImage(index: number) {
    setImageFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      previews.forEach((u) => URL.revokeObjectURL(u));
      setPreviews(next.map((f) => URL.createObjectURL(f)));
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      let imageUrls: string[] = [];

      if (imageFiles.length > 0) {
        setUploading(true);
        imageUrls = await api.upload(imageFiles);
        setUploading(false);
      }

      const categoryIds = form.selectedCategories
        .filter((c) => c !== "__custom")
        .map((c) => categories.find((cat) => cat.name === c)?.id)
        .filter((id): id is number => id !== undefined);
      const customCategories = form.selectedCategories.includes("__custom")
        ? form.customCategory
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        : [];

      const allImageUrls = [...existingImages, ...imageUrls];
      const payload = {
        title: form.title,
        description: form.description,
        category_ids: categoryIds,
        custom_categories: customCategories.length > 0 ? customCategories : undefined,
        starting_price: Number(parseFormattedNumber(form.startingPrice)),
        min_increment: Number(parseFormattedNumber(form.minIncrement)),
        start_time: new Date(form.startTime).toISOString(),
        end_time: new Date(form.endTime).toISOString(),
        images: allImageUrls.length > 0 ? allImageUrls : undefined,
      };

      if (editId) {
        await api.updateAuction(editId, payload);
      } else {
        await api.createAuction(payload);
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setErrors({ submit: err instanceof Error ? err.message : "Đăng bán thất bại" });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  function formatNumberInput(value: string): string {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("en-US");
  }

  function parseFormattedNumber(value: string): string {
    return value.replace(/,/g, "");
  }

  function handleChange(field: string, value: string) {
    if (field === "startingPrice" || field === "minIncrement") {
      const raw = parseFormattedNumber(value);
      if (!/^\d*$/.test(raw)) return;
      setForm((prev) => ({ ...prev, [field]: formatNumberInput(raw) }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  if (editLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-zinc-400">Đang tải thông tin sản phẩm...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-md rounded-sm bg-white p-8 text-center shadow-sm dark:bg-zinc-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
              <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{editId ? "Cập nhật thành công!" : "Đăng bán thành công!"}</h2>
              <p className="mt-2 text-sm text-zinc-500">
                {editId ? `Sản phẩm "${form.title}" đã được cập nhật.` : `Sản phẩm "${form.title}" đã được đăng lên hệ thống.`}
              </p>
              {editId ? (
                <Link href={`/auction/${editId}`} className="mt-6 inline-block rounded-sm bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover">
                  Xem sản phẩm
                </Link>
              ) : (
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setForm({ title: "", description: "", selectedCategories: [], customCategory: "", startingPrice: "", minIncrement: "", ...getDefaultTimes() });
                    setImageFiles([]);
                    setExistingImages([]);
                  }}
                  className="mt-6 rounded-sm bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  Đăng sản phẩm khác
                </button>
              )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="rounded-sm bg-white shadow-sm dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{editId ? "Chỉnh sửa sản phẩm" : "Đăng sản phẩm đấu giá"}</h1>
            <p className="mt-1 text-sm text-zinc-400">{editId ? "Cập nhật thông tin sản phẩm của bạn" : "Điền thông tin sản phẩm để bắt đầu đấu giá"}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
            {/* Tên sản phẩm */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Tên sản phẩm <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="VD: iPhone 15 Pro Max 256GB"
                className={`w-full rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors ${
                  errors.title ? "border-red-500" : "border-zinc-200 focus:border-primary dark:border-zinc-700"
                } dark:bg-zinc-800 dark:text-zinc-100`}
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
            </div>

            {/* Mô tả */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Mô tả <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Mô tả chi tiết về tình trạng, đặc điểm sản phẩm..."
                rows={4}
                className={`w-full resize-none rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors ${
                  errors.description ? "border-red-500" : "border-zinc-200 focus:border-primary dark:border-zinc-700"
                } dark:bg-zinc-800 dark:text-zinc-100`}
              />
              {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
            </div>

            {/* Danh mục */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Danh mục <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCategoryOpen((prev) => !prev)}
                  className={`w-full rounded-sm border px-3 py-2.5 text-left text-sm outline-none transition-colors ${
                    errors.selectedCategories ? "border-red-500" : "border-zinc-200 focus:border-primary dark:border-zinc-700"
                  } dark:bg-zinc-800 dark:text-zinc-100 flex items-center justify-between gap-3`}
                >
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {selectedDisplayCategories.length > 0
                      ? selectedDisplayCategories
                      : "Chọn danh mục"}
                  </span>
                  <span className="text-zinc-400">▾</span>
                </button>
                {categoryOpen && (
                  <div className="absolute left-0 right-0 z-10 mt-2 max-h-64 overflow-auto rounded-sm border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                    {categories.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex cursor-pointer items-center gap-3 border-b border-zinc-200 px-4 py-2 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        <input
                          type="checkbox"
                          checked={form.selectedCategories.includes(cat.name)}
                          onChange={() => {
                            setForm((prev) => {
                              const exists = prev.selectedCategories.includes(cat.name);
                              const next = exists
                                ? prev.selectedCategories.filter((c) => c !== cat.name)
                                : [...prev.selectedCategories, cat.name];
                              return { ...prev, selectedCategories: next };
                            });
                            if (errors.selectedCategories) setErrors((prev) => ({ ...prev, selectedCategories: "" }));
                          }}
                          className="h-4 w-4 rounded border-zinc-300 text-primary accent-primary"
                        />
                        <span className="text-zinc-700 dark:text-zinc-300">{cat.name}</span>
                      </label>
                    ))}
                    <label className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-2 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={form.selectedCategories.includes("__custom")}
                          onChange={() => {
                            setForm((prev) => {
                              const exists = prev.selectedCategories.includes("__custom");
                              const next = exists
                                ? prev.selectedCategories.filter((c) => c !== "__custom" && !parsedCustomCategories.includes(c))
                                : [...prev.selectedCategories, "__custom"];
                              return {
                                ...prev,
                                selectedCategories: next,
                                customCategory: exists ? "" : prev.customCategory,
                              };
                            });
                            if (errors.selectedCategories) setErrors((prev) => ({ ...prev, selectedCategories: "" }));
                          }}
                          className="h-4 w-4 rounded border-zinc-300 text-primary accent-primary"
                        />
                        <span className="text-zinc-700 dark:text-zinc-300">Khác</span>
                      </div>
                      {form.selectedCategories.includes("__custom") && (
                        <div className="pt-2">
                          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Nhập danh mục khác
                          </label>
                          <input
                            ref={customCategoryRef}
                            type="text"
                            value={form.customCategory}
                            onChange={(e) => handleChange("customCategory", e.target.value)}
                            placeholder="VD: Nội thất, Nghệ thuật, Đồ cổ"
                            className={`w-full rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors ${
                              errors.customCategory ? "border-red-500" : "border-zinc-200 focus:border-primary dark:border-zinc-700"
                            } dark:bg-zinc-800 dark:text-zinc-100`}
                          />
                          <p className="mt-1 text-xs text-zinc-500">Nhập nhiều danh mục, dùng dấu phẩy để phân tách.</p>
                          {errors.customCategory && <p className="mt-1 text-xs text-red-500">{errors.customCategory}</p>}
                        </div>
                      )}
                    </label>
                    <div className="border-t border-zinc-200 px-4 py-3 text-right dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={handleConfirmCustomCategories}
                        disabled={
                          form.selectedCategories.length === 0 ||
                          (form.selectedCategories.includes("__custom") && parsedCustomCategories.length === 0)
                        }
                        className="inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition-colors disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
                      >
                        Xác nhận
                      </button>
                    </div>
                  </div>
                )}
                {errors.selectedCategories && <p className="mt-1 text-xs text-red-500">{errors.selectedCategories}</p>}
              </div>
            </div>

            {/* Giá & bước giá */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Giá khởi điểm (đ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.startingPrice}
                  onChange={(e) => handleChange("startingPrice", e.target.value)}
                  placeholder="1,000,000"
                  className={`w-full rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors ${
                    errors.startingPrice ? "border-red-500" : "border-zinc-200 focus:border-primary dark:border-zinc-700"
                  } dark:bg-zinc-800 dark:text-zinc-100`}
                />
                {errors.startingPrice && <p className="mt-1 text-xs text-red-500">{errors.startingPrice}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Bước giá tối thiểu (đ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.minIncrement}
                  onChange={(e) => handleChange("minIncrement", e.target.value)}
                  placeholder="100,000"
                  className={`w-full rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors ${
                    errors.minIncrement ? "border-red-500" : "border-zinc-200 focus:border-primary dark:border-zinc-700"
                  } dark:bg-zinc-800 dark:text-zinc-100`}
                />
                {errors.minIncrement && <p className="mt-1 text-xs text-red-500">{errors.minIncrement}</p>}
              </div>
            </div>

            {/* Thời gian */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Thời gian đấu giá
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[12px] text-zinc-400">
                    Bắt đầu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startTime}
                    onChange={(e) => handleChange("startTime", e.target.value)}
                    className={`w-full rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors ${
                      errors.startTime ? "border-red-500" : "border-zinc-200 focus:border-primary dark:border-zinc-700"
                    } dark:bg-zinc-800 dark:text-zinc-100`}
                  />
                  {errors.startTime && <p className="mt-1 text-xs text-red-500">{errors.startTime}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-zinc-400">
                    Kết thúc <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.endTime}
                    onChange={(e) => handleChange("endTime", e.target.value)}
                    className={`w-full rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors ${
                      errors.endTime ? "border-red-500" : "border-zinc-200 focus:border-primary dark:border-zinc-700"
                    } dark:bg-zinc-800 dark:text-zinc-100`}
                  />
                  {errors.endTime && <p className="mt-1 text-xs text-red-500">{errors.endTime}</p>}
                </div>
              </div>
            </div>

            {/* Upload ảnh */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Hình ảnh sản phẩm
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-sm border-2 border-dashed border-zinc-300 bg-zinc-50 py-8 text-sm text-zinc-500 transition-colors hover:border-primary hover:text-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Chọn ảnh từ máy
              </button>
              <p className="mt-1 text-[12px] text-zinc-400">
                Hỗ trợ JPG, PNG, WebP. Tối đa 10 ảnh, mỗi ảnh dưới 5MB.
              </p>

              {/* Preview */}
              {(existingImages.length > 0 || previews.length > 0) && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {existingImages.map((src, i) => (
                    <div key={`existing-${i}`} className="group relative aspect-square overflow-hidden rounded-sm border border-zinc-200 dark:border-zinc-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setExistingImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {i === 0 && previews.length === 0 && (
                        <span className="absolute bottom-0 left-0 bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Ảnh chính
                        </span>
                      )}
                    </div>
                  ))}
                  {previews.map((src, i) => (
                    <div key={src} className="group relative aspect-square overflow-hidden rounded-sm border border-zinc-200 dark:border-zinc-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Ảnh ${existingImages.length + i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {existingImages.length === 0 && i === 0 && (
                        <span className="absolute bottom-0 left-0 bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Ảnh chính
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}

            {/* Submit */}
            <div className="flex items-center justify-between border-t border-zinc-100 pt-5 dark:border-zinc-800">
              <p className="text-[12px] text-zinc-400">
                <span className="text-red-500">*</span> Bắt buộc
              </p>
              <button
                type="submit"
                disabled={loading || uploading}
                className="rounded-sm bg-accent px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:opacity-50"
              >
                {uploading ? "Đang upload ảnh..." : loading ? (editId ? "Đang cập nhật..." : "Đang đăng...") : editId ? "Cập nhật" : "Đăng bán"}
              </button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
