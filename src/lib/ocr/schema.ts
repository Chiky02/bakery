import { z } from "zod";

export const ocrParseInput = z
  .object({
    media_urls: z.array(z.string().url()).min(1).max(8),
  })
  .strict();

export const ocrRawLineSchema = z.object({
  raw_name: z.string().trim().min(1).max(255),
  quantity: z.number().finite().positive(),
  unit_price: z.number().finite().nonnegative().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const ocrRawResponseSchema = z.object({
  lines: z.array(ocrRawLineSchema).default([]),
});

export const ocrMatchedLineSchema = z.object({
  raw_name: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().finite().nonnegative().nullable(),
  confidence: z.number().min(0).max(1),
  source_index: z.number().int().nonnegative(),
  fk_product: z.string().uuid().nullable(),
  product_name: z.string().nullable(),
  catalog_unit_price: z.number().finite().nonnegative().nullable(),
  match_score: z.number().min(0).max(1).nullable(),
  candidates: z.array(
    z.object({
      fk_product: z.string().uuid(),
      name: z.string(),
      unit_price: z.number().finite().nonnegative(),
      score: z.number().min(0).max(1),
    }),
  ),
});

export type OcrParseInput = z.infer<typeof ocrParseInput>;
export type OcrRawLine = z.infer<typeof ocrRawLineSchema>;
export type OcrMatchedLine = z.infer<typeof ocrMatchedLineSchema>;
