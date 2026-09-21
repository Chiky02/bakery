"use client";

import { useEffect, useId, useState, useTransition, type ChangeEvent } from "react";
import { ScanLine, Trash2 } from "lucide-react";
import type { Producto } from "@/types";
import { Button } from "@/components/ui/button";
import {
  OcrLinesReviewModal,
  type OcrAcceptedLine,
} from "@/components/app/ocr-lines-review-modal";
import type { OcrMatchedLine } from "@/lib/ocr/schema";

type DraftScanImage = {
  key: string;
  file: File;
  label: string;
};

const ACCEPTED =
  "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 8;

function isHeicHeifFile(file: File) {
  const type = (file.type ?? "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  const lowerName = (file.name ?? "").toLowerCase();
  return lowerName.endsWith(".heic") || lowerName.endsWith(".heif");
}

async function convertHeicHeifToJpeg(file: File): Promise<File> {
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  const maxDimension = 2500;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
      const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Canvas context not available");
      ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92);
      });
      if (!blob) throw new Error("Failed to convert image to JPEG");
      return new File([blob], `${baseName}.jpg`, {
        type: "image/jpeg",
        lastModified: file.lastModified,
      });
    } catch {
      /* fallback below */
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    img.src = objectUrl;
    if (typeof img.decode === "function") {
      await img.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to decode image"));
      });
    }
    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(originalWidth * scale));
    canvas.height = Math.max(1, Math.round(originalHeight * scale));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas context not available");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92);
    });
    if (!blob) throw new Error("Failed to convert image to JPEG");
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function OcrScanPanel({
  products,
  disabled = false,
  onApplyLines,
}: {
  products: Producto[];
  disabled?: boolean;
  onApplyLines: (lines: OcrAcceptedLine[]) => void;
}) {
  const inputId = useId();
  const [ocrEnabled, setOcrEnabled] = useState<boolean | null>(null);
  const [images, setImages] = useState<DraftScanImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reviewLines, setReviewLines] = useState<OcrMatchedLine[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void fetch("/api/ocr/status")
      .then(async (res) => {
        if (!res.ok) throw new Error("status");
        return res.json() as Promise<{ data?: { enabled?: boolean } }>;
      })
      .then((body) => {
        if (!active) return;
        setOcrEnabled(Boolean(body.data?.enabled));
      })
      .catch(() => {
        if (active) setOcrEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;
    setError(null);

    const next = [...images];
    for (const original of selected) {
      if (next.length >= MAX_FILES) {
        setError(`Puedes escanear máximo ${MAX_FILES} archivos a la vez.`);
        break;
      }
      let file = original;
      if (isHeicHeifFile(original)) {
        try {
          file = await convertHeicHeifToJpeg(original);
        } catch {
          setError("No se pudo convertir HEIC/HEIF. Exporta la foto como JPEG.");
          continue;
        }
      }
      const typeOk =
        !file.type ||
        file.type === "image/jpeg" ||
        file.type === "image/png" ||
        file.type === "image/webp" ||
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!typeOk) {
        setError("Solo se aceptan JPEG, PNG, WebP, HEIC/HEIF o PDF.");
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError("Cada archivo debe pesar máximo 10 MB.");
        continue;
      }
      next.push({
        key: `${file.name}-${file.size}-${Date.now()}-${next.length}`,
        file,
        label: file.name,
      });
    }
    setImages(next);
  }

  function runScan() {
    if (images.length === 0) {
      setError("Agrega al menos una foto o PDF del pedido.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      for (const item of images) form.append("files", item.file, item.label);
      const res = await fetch("/api/ocr/parse", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: { lines?: OcrMatchedLine[] };
      };
      if (!res.ok) {
        const providerDown = res.status === 502 || res.status === 503;
        setError(
          providerDown
            ? "El proveedor OCR no está disponible. Revisa OCR_API_KEY / OCR_MODEL."
            : (body.error ?? "No se pudo escanear el documento."),
        );
        return;
      }
      const lines = body.data?.lines ?? [];
      if (lines.length === 0) {
        setError("No se leyeron líneas en el documento.");
        return;
      }
      setReviewLines(lines);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3 sm:p-4">
      <div>
        <h4 className="text-sm font-semibold text-stone-900">Escanear pedido (OCR)</h4>
        <p className="mt-1 text-xs text-stone-500">
          Sube fotos o el PDF de la factura / orden de compra y prellenamos los ítems de la
          recepción.
        </p>
      </div>

      {ocrEnabled === false ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          OCR desactivado. Configura OCR_ENABLED=true y OCR_API_KEY en el .env.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div>
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED}
          multiple
          disabled={disabled || pending || ocrEnabled === false}
          className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-amber-700 disabled:opacity-50"
          onChange={onFileChange}
        />
      </div>

      <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {images.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <p className="truncate" title={item.label}>
              {item.label}
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              title="Quitar"
              aria-label="Quitar"
              onClick={() => setImages((prev) => prev.filter((row) => row.key !== item.key))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
        {images.length === 0 ? (
          <li className="px-3 py-3 text-sm text-stone-500">Aún no hay documentos.</li>
        ) : null}
      </ul>

      <Button
        type="button"
        variant="secondary"
        className="gap-1"
        disabled={disabled || pending || ocrEnabled === false || images.length === 0}
        onClick={runScan}
      >
        <ScanLine className="h-4 w-4" />
        {pending ? "Escaneando…" : "Escanear pedido"}
      </Button>

      <OcrLinesReviewModal
        open={Boolean(reviewLines)}
        lines={reviewLines ?? []}
        products={products}
        pending={pending}
        onCancel={() => setReviewLines(null)}
        onConfirm={(accepted) => {
          onApplyLines(accepted);
          setReviewLines(null);
          setImages([]);
          setError(null);
        }}
      />
    </div>
  );
}
