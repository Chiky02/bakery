import { NextResponse } from "next/server";
import { requireApiFeature } from "@/lib/api-context";
import { ocrEnv } from "@/lib/ocr/env";
import { isOcrConfigured } from "@/lib/ocr/vision.provider";

export const runtime = "nodejs";

export async function GET() {
  const result = await requireApiFeature("recepciones");
  if (result instanceof NextResponse) return result;

  return NextResponse.json({
    data: {
      enabled: isOcrConfigured(),
      provider: ocrEnv.OCR_PROVIDER,
      model: ocrEnv.OCR_MODEL ?? (ocrEnv.OCR_PROVIDER === "openai" ? "gpt-4o" : "gemini-3.5-flash"),
    },
  });
}
