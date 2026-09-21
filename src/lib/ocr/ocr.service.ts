import type { SupabaseClient } from "@supabase/supabase-js";
import type { OcrMatchedLine, OcrRawLine } from "./schema";
import { matchProducts, type CatalogProduct } from "./product-match";
import {
  documentFromBuffer,
  parseOrderDocument,
  parseOrderImage,
} from "./vision.provider";

function toPositiveIntQuantity(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.round(value);
  return rounded >= 1 ? rounded : null;
}

function toMoneyOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

async function loadCatalog(
  supabase: SupabaseClient,
  panaderiaId: string,
): Promise<CatalogProduct[]> {
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, precio")
    .eq("panaderia_id", panaderiaId)
    .eq("disponible", true)
    .limit(5000);

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: 500 });
  }

  return (data ?? []).map((product) => ({
    pk_product: product.id,
    name: product.nombre,
    unit_price: Number(product.precio) || 0,
  }));
}

function matchRawLines(
  rawLines: Array<OcrRawLine & { source_index: number }>,
  catalog: CatalogProduct[],
): OcrMatchedLine[] {
  const matched: OcrMatchedLine[] = [];

  for (const raw of rawLines) {
    const quantity = toPositiveIntQuantity(raw.quantity);
    if (!quantity) continue;

    const { best, candidates } = matchProducts(raw.raw_name, catalog);
    const unitPrice = toMoneyOrNull(raw.unit_price) ?? (best ? best.unit_price : null);

    matched.push({
      raw_name: raw.raw_name,
      quantity,
      unit_price: unitPrice,
      confidence: raw.confidence ?? 0.5,
      source_index: raw.source_index,
      fk_product: best?.fk_product ?? null,
      product_name: best?.name ?? null,
      catalog_unit_price: best?.unit_price ?? null,
      match_score: best?.score ?? null,
      candidates: candidates.map((candidate) => ({
        fk_product: candidate.fk_product,
        name: candidate.name,
        unit_price: candidate.unit_price,
        score: candidate.score,
      })),
    });
  }

  return matched;
}

export async function parseOrderDocuments(input: {
  supabase: SupabaseClient;
  panaderiaId: string;
  mediaUrls?: string[];
  files?: Array<{ buffer: Buffer; mimeType?: string; fileName?: string }>;
}): Promise<{ lines: OcrMatchedLine[]; images_processed: number }> {
  const catalog = await loadCatalog(input.supabase, input.panaderiaId);
  const collected: Array<OcrRawLine & { source_index: number }> = [];
  const mediaUrls = input.mediaUrls ?? [];
  const files = input.files ?? [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;
    const document = await documentFromBuffer(file);
    const lines = await parseOrderDocument(document);
    for (const line of lines) {
      collected.push({ ...line, source_index: index });
    }
  }

  for (let index = 0; index < mediaUrls.length; index += 1) {
    const mediaUrl = mediaUrls[index]!;
    const lines = await parseOrderImage(mediaUrl);
    for (const line of lines) {
      collected.push({ ...line, source_index: files.length + index });
    }
  }

  return {
    lines: matchRawLines(collected, catalog),
    images_processed: files.length + mediaUrls.length,
  };
}
