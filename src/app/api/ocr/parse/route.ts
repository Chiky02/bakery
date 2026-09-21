import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiFeature } from "@/lib/api-context";
import { ocrEnv } from "@/lib/ocr/env";
import { parseOrderDocuments } from "@/lib/ocr/ocr.service";
import { ocrParseInput } from "@/lib/ocr/schema";
import { isOcrConfigured } from "@/lib/ocr/vision.provider";
import { tooLargeBody } from "@/lib/rate-limit-public";

export const runtime = "nodejs";
export const maxDuration = 60;

const parseHits = new Map<string, { n: number; t: number }>();

function allowParse(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 10;
  const cur = parseHits.get(userId);
  if (!cur || now - cur.t > windowMs) {
    parseHits.set(userId, { n: 1, t: now });
    return true;
  }
  if (cur.n >= max) return false;
  cur.n += 1;
  return true;
}

function statusFromError(error: unknown): number {
  if (error && typeof error === "object" && "statusCode" in error) {
    const code = (error as { statusCode: unknown }).statusCode;
    if (typeof code === "number" && code >= 400 && code < 600) return code;
  }
  return 500;
}

function messageFromError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "OCR failed.";
}

export async function POST(request: Request) {
  const result = await requireApiFeature("recepciones");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  if (!isOcrConfigured()) {
    return NextResponse.json(
      { error: "OCR is not configured. Set OCR_ENABLED=true and OCR_API_KEY on the API." },
      { status: 503 },
    );
  }

  if (!allowParse(ctx.profile.id)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  if (tooLargeBody(request, 40 * 1024 * 1024)) {
    return NextResponse.json({ error: "Document exceeds 10 MB for OCR." }, { status: 413 });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let mediaUrls: string[] = [];
    const files: Array<{ buffer: Buffer; mimeType?: string; fileName?: string }> = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const uploaded = form
        .getAll("files")
        .filter((value): value is File => typeof File !== "undefined" && value instanceof File);
      for (const file of uploaded) {
        files.push({
          buffer: Buffer.from(await file.arrayBuffer()),
          mimeType: file.type || undefined,
          fileName: file.name,
        });
      }
      const urlFields = form
        .getAll("media_urls")
        .map((value) => String(value).trim())
        .filter(Boolean);
      if (urlFields.length > 0) {
        mediaUrls = ocrParseInput.parse({ media_urls: urlFields }).media_urls;
      }
    } else {
      const input = ocrParseInput.parse(await request.json());
      mediaUrls = input.media_urls;
    }

    if (files.length + mediaUrls.length === 0) {
      return NextResponse.json({ error: "At least one image is required." }, { status: 400 });
    }
    if (files.length + mediaUrls.length > 8) {
      return NextResponse.json({ error: "You can scan at most 8 images at once." }, { status: 400 });
    }

    const parsed = await parseOrderDocuments({
      supabase,
      panaderiaId: ctx.panaderia.id,
      mediaUrls,
      files,
    });

    return NextResponse.json({
      data: parsed,
      meta: {
        permission: "recepciones",
        provider: ocrEnv.OCR_PROVIDER,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid OCR payload." }, { status: 400 });
    }
    return NextResponse.json({ error: messageFromError(error) }, { status: statusFromError(error) });
  }
}
