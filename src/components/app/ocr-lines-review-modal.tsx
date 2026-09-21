"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Producto } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductSearchSelect } from "@/components/app/product-search-select";
import { formatCOP } from "@/lib/format";
import type { OcrMatchedLine } from "@/lib/ocr/schema";
import {
  ocrScoreBadgeClass,
  ocrScorePercent,
  ocrScoreTextClass,
} from "@/lib/ocr/ocr-similarity";

export type OcrAcceptedLine = {
  fk_product: string;
  name: string;
  quantity: number;
  unit_price: number;
  notes: string;
};

type DraftRow = {
  key: string;
  selected: boolean;
  raw_name: string;
  quantity: number;
  unit_price: number;
  fk_product: string | null;
  product_name: string | null;
  candidates: OcrMatchedLine["candidates"];
  confidence: number;
  source_index: number;
};

function toDraftRows(lines: OcrMatchedLine[]): DraftRow[] {
  return lines.map((line, index) => ({
    key: `${line.source_index}-${index}-${line.raw_name}`,
    selected: Boolean(line.fk_product),
    raw_name: line.raw_name,
    quantity: Math.max(1, Math.round(line.quantity) || 1),
    unit_price: Number(line.unit_price ?? line.catalog_unit_price ?? 0) || 0,
    fk_product: line.fk_product,
    product_name: line.product_name,
    candidates: line.candidates,
    confidence: line.confidence,
    source_index: line.source_index,
  }));
}

export function OcrLinesReviewModal({
  open,
  lines,
  products,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  lines: OcrMatchedLine[];
  products: Producto[];
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (accepted: OcrAcceptedLine[]) => void;
}) {
  if (!open) return null;
  return (
    <OcrLinesReviewBody
      lines={lines}
      products={products}
      pending={pending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function OcrLinesReviewBody({
  lines,
  products,
  pending,
  onCancel,
  onConfirm,
}: {
  lines: OcrMatchedLine[];
  products: Producto[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: (accepted: OcrAcceptedLine[]) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(() => toDraftRows(lines));
  const productOptions = products.map((p) => ({
    id: p.id,
    label: p.nombre,
    hint: p.codigo_barras ?? undefined,
  }));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancel();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [pending, onCancel]);

  const selectedCount = useMemo(
    () => rows.filter((row) => row.selected && row.fk_product).length,
    [rows],
  );

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function assignProduct(key: string, product: Producto) {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              fk_product: product.id,
              product_name: product.nombre,
              unit_price: row.unit_price > 0 ? row.unit_price : Number(product.precio) || 0,
              selected: true,
            }
          : row,
      ),
    );
  }

  function submit() {
    const accepted: OcrAcceptedLine[] = [];
    for (const row of rows) {
      if (!row.selected || !row.fk_product || !row.product_name) continue;
      if (row.quantity < 1) continue;
      accepted.push({
        fk_product: row.fk_product,
        name: row.product_name,
        quantity: Math.max(1, Math.round(row.quantity) || 1),
        unit_price: Math.max(0, Number(row.unit_price) || 0),
        notes: `OCR: ${row.raw_name}`,
      });
    }
    onConfirm(accepted);
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:items-center">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[min(90dvh,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl outline-none"
      >
        <div className="shrink-0 border-b border-stone-200 px-4 py-3 sm:px-5">
          <h2 id={titleId} className="text-base font-semibold text-stone-900">
            Revisar líneas del OCR
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Confirma el producto, la cantidad y el costo antes de cargarlas en la recepción.
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Verde ≥ 72% coincidencia automática · ámbar revisar · rojo sin match
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 [-webkit-overflow-scrolling:touch] sm:px-5">
          {rows.length === 0 ? (
            <p className="py-6 text-sm text-stone-500">No se leyeron líneas en el documento.</p>
          ) : (
            rows.map((row) => (
              <article
                key={row.key}
                className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={row.selected && Boolean(row.fk_product)}
                    disabled={!row.fk_product}
                    onChange={(e) => updateRow(row.key, { selected: e.target.checked })}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-900">{row.raw_name}</p>
                    <p className={`text-xs font-medium ${ocrScoreTextClass(row.confidence)}`}>
                      Confianza {ocrScorePercent(row.confidence)}% · imagen {row.source_index + 1}
                    </p>
                  </div>
                </div>

                {row.product_name ? (
                  <p className="text-sm">
                    <span className="text-stone-500">Emparejado: </span>
                    <span className={`font-medium ${ocrScoreTextClass(row.confidence)}`}>
                      {row.product_name}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm font-medium text-red-700">Sin coincidencia automática</p>
                )}

                {row.candidates.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {row.candidates.map((candidate) => (
                      <span
                        key={candidate.fk_product}
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ocrScoreBadgeClass(candidate.score)}`}
                      >
                        {candidate.name} · {ocrScorePercent(candidate.score)}%
                      </span>
                    ))}
                  </div>
                ) : null}

                {row.candidates.length > 0 ? (
                  <label className="block space-y-1 text-xs font-medium text-stone-600">
                    <span>Elegir candidato</span>
                    <select
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                      value={row.fk_product ?? ""}
                      onChange={(e) => {
                        const candidate = row.candidates.find(
                          (item) => item.fk_product === e.target.value,
                        );
                        if (!candidate) return;
                        updateRow(row.key, {
                          fk_product: candidate.fk_product,
                          product_name: candidate.name,
                          unit_price: row.unit_price > 0 ? row.unit_price : candidate.unit_price,
                          selected: true,
                        });
                      }}
                    >
                      <option value="">Elegir producto</option>
                      {row.candidates.map((candidate) => (
                        <option key={candidate.fk_product} value={candidate.fk_product}>
                          {candidate.name} ({ocrScorePercent(candidate.score)}%)
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {!row.fk_product ? (
                  <ProductSearchSelect
                    options={productOptions}
                    value=""
                    allowEmpty={false}
                    placeholder="Buscar producto del catálogo…"
                    onChange={(id) => {
                      const product = products.find((p) => p.id === id);
                      if (product) assignProduct(row.key, product);
                    }}
                  />
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1 text-xs font-medium text-stone-600">
                    <span>Cantidad</span>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(row.key, {
                          quantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>
                  <label className="block space-y-1 text-xs font-medium text-stone-600">
                    <span>Costo unitario</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={row.unit_price}
                      onChange={(e) =>
                        updateRow(row.key, {
                          unit_price: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </label>
                </div>
                <p className="text-xs font-semibold text-stone-900">
                  Subtotal: {formatCOP(row.quantity * row.unit_price)}
                </p>
              </article>
            ))
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-stone-200 px-4 py-3 sm:px-5">
          <p className="text-sm text-stone-500">{selectedCount} línea(s) seleccionadas</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" disabled={pending || selectedCount === 0} onClick={submit}>
              Aplicar líneas
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
