import { ocrEnv } from "./env";
import { normalizeUploadImage } from "./image-normalize";
import { ocrRawResponseSchema, type OcrRawLine } from "./schema";

const SYSTEM_PROMPT = `You extract purchase-order / invoice / delivery-note line items from document images or PDF invoices.
Return ONLY valid JSON with this shape:
{"lines":[{"raw_name":"string","quantity":number,"unit_price":number|null,"confidence":number}]}
Rules:
- raw_name: product description as written on the document
- quantity: positive number (use integers when possible)
- unit_price: unit price if visible, otherwise null (ignore line totals when unit price is unclear)
- confidence: 0..1 for how sure you are about that line
- Ignore headers, supplier info, taxes, grand totals, and payment terms
- Read all pages when the document is a multi-page PDF
- If nothing readable: {"lines":[]}
- Do not invent products that are not on the document`;

export type DownloadedDocument = {
  mimeType: string;
  base64: string;
  fileName: string;
};

export async function documentFromBuffer(input: {
  buffer: Buffer;
  mimeType?: string;
  fileName?: string;
}): Promise<DownloadedDocument> {
  if (input.buffer.byteLength === 0) {
    throw Object.assign(new Error("Downloaded document is empty."), { statusCode: 422 });
  }
  if (input.buffer.byteLength > 10 * 1024 * 1024) {
    throw Object.assign(new Error("Document exceeds 10 MB for OCR."), { statusCode: 413 });
  }

  let normalized: Awaited<ReturnType<typeof normalizeUploadImage>>;
  try {
    normalized = await normalizeUploadImage({
      buffer: input.buffer,
      mimeType: input.mimeType,
      fileName: input.fileName,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof (error as { statusCode: unknown }).statusCode === "number"
    ) {
      throw error;
    }
    throw Object.assign(
      new Error("OCR only accepts JPEG, PNG, WebP, GIF, HEIC/HEIF, or PDF files."),
      { statusCode: 422 },
    );
  }

  return {
    mimeType: normalized.mimeType,
    base64: normalized.buffer.toString("base64"),
    fileName: fileNameFromHint(input.fileName, normalized.mimeType),
  };
}

async function downloadDocument(mediaUrl: string): Promise<DownloadedDocument> {
  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw Object.assign(new Error(`Could not download document (${response.status}).`), {
      statusCode: 422,
    });
  }
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const buffer = Buffer.from(await response.arrayBuffer());
  return documentFromBuffer({
    buffer,
    mimeType: contentType || guessMimeFromUrl(mediaUrl),
    fileName: fileNameHintFromUrl(mediaUrl),
  });
}

function fileNameHintFromUrl(url: string): string | undefined {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "");
  } catch {
    return undefined;
  }
}

function fileNameFromHint(hint: string | undefined, mimeType: string): string {
  if (hint?.trim()) return hint.trim();
  if (mimeType === "application/pdf") return "document.pdf";
  if (mimeType === "image/png") return "document.png";
  if (mimeType === "image/webp") return "document.webp";
  if (mimeType === "image/gif") return "document.gif";
  return "document.jpg";
}

function guessMimeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".pdf")) return "application/pdf";
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.includes(".heic") || lower.includes(".heif")) return "image/heic";
  return "image/jpeg";
}

function parseModelJson(text: string): OcrRawLine[] {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fenced?.[1]?.trim() ?? trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw Object.assign(new Error("OCR provider returned invalid JSON."), { statusCode: 502 });
  }
  const result = ocrRawResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw Object.assign(new Error("OCR provider returned an unexpected schema."), {
      statusCode: 502,
    });
  }
  return result.data.lines;
}

function openAiUserContent(document: DownloadedDocument) {
  const textPart = {
    type: "text" as const,
    text: "Extract the purchase line items from this document.",
  };
  if (document.mimeType === "application/pdf") {
    return [
      textPart,
      {
        type: "file" as const,
        file: {
          filename: document.fileName.endsWith(".pdf") ? document.fileName : "document.pdf",
          file_data: `data:application/pdf;base64,${document.base64}`,
        },
      },
    ];
  }
  return [
    textPart,
    {
      type: "image_url" as const,
      image_url: {
        url: `data:${document.mimeType};base64,${document.base64}`,
      },
    },
  ];
}

async function parseWithOpenAI(
  document: DownloadedDocument,
  model: string,
  apiKey: string,
): Promise<OcrRawLine[]> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: openAiUserContent(document),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    const statusCode = response.status === 429 ? 429 : 502;
    const message =
      response.status === 429
        ? "OpenAI OCR quota exceeded. Check billing/limits or wait before retrying."
        : `OpenAI OCR failed (${response.status}): ${detail.slice(0, 240)}`;
    throw Object.assign(new Error(message), { statusCode });
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw Object.assign(new Error("OpenAI OCR returned an empty response."), { statusCode: 502 });
  }
  return parseModelJson(content);
}

async function parseWithGemini(
  document: DownloadedDocument,
  model: string,
  apiKey: string,
): Promise<OcrRawLine[]> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: `${SYSTEM_PROMPT}\n\nExtract the purchase line items from this document.` },
            {
              inline_data: {
                mime_type: document.mimeType,
                data: document.base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    const statusCode = response.status === 429 ? 429 : response.status === 404 ? 404 : 502;
    let message =
      response.status === 429
        ? "Gemini OCR quota exceeded. Wait a bit, enable billing in Google AI Studio, or switch OCR_PROVIDER to openai."
        : `Gemini OCR failed (${response.status}): ${detail.slice(0, 240)}`;
    if (response.status === 404) {
      message =
        "Gemini model not found or retired for new users. Set OCR_MODEL=gemini-3.5-flash (or gemini-flash-latest) and restart the API.";
    }
    throw Object.assign(new Error(message), { statusCode });
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content =
    payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!content.trim()) {
    throw Object.assign(new Error("Gemini OCR returned an empty response."), { statusCode: 502 });
  }
  return parseModelJson(content);
}

async function parseDownloaded(document: DownloadedDocument): Promise<OcrRawLine[]> {
  if (!ocrEnv.OCR_ENABLED) {
    throw Object.assign(new Error("OCR is disabled. Set OCR_ENABLED=true and OCR_API_KEY."), {
      statusCode: 503,
    });
  }
  if (!ocrEnv.OCR_API_KEY) {
    throw Object.assign(new Error("OCR_API_KEY is not configured."), { statusCode: 503 });
  }

  const provider = ocrEnv.OCR_PROVIDER;
  const model = ocrEnv.OCR_MODEL ?? (provider === "openai" ? "gpt-4o" : "gemini-3.5-flash");

  if (provider === "openai") {
    return parseWithOpenAI(document, model, ocrEnv.OCR_API_KEY);
  }
  return parseWithGemini(document, model, ocrEnv.OCR_API_KEY);
}

export async function parseOrderImage(mediaUrl: string): Promise<OcrRawLine[]> {
  const document = await downloadDocument(mediaUrl);
  return parseDownloaded(document);
}

export async function parseOrderDocument(document: DownloadedDocument): Promise<OcrRawLine[]> {
  return parseDownloaded(document);
}

export function isOcrConfigured(): boolean {
  return Boolean(ocrEnv.OCR_ENABLED && ocrEnv.OCR_API_KEY);
}
