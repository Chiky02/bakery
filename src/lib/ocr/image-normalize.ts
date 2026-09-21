import convert from "heic-convert";

export type UploadMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "application/pdf";

const HEIC_BRANDS = /heic|heif|mif1|msf1|hevc|hevx|heim|heis|hevm|hevs/i;

export const isJpeg = (buffer: Buffer) =>
  buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));

export const isPng = (buffer: Buffer) =>
  buffer.length >= 8 &&
  buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

export const isWebp = (buffer: Buffer) =>
  buffer.length >= 12 &&
  buffer.subarray(0, 4).equals(Buffer.from("RIFF")) &&
  buffer.subarray(8, 12).equals(Buffer.from("WEBP"));

export const isGif = (buffer: Buffer) => {
  if (buffer.length < 6) return false;
  const header = buffer.subarray(0, 6).toString("ascii");
  return header === "GIF87a" || header === "GIF89a";
};

export const isPdf = (buffer: Buffer) =>
  buffer.length >= 5 && buffer.subarray(0, 5).toString("utf8") === "%PDF-";

/** ISO BMFF HEIC/HEIF: bytes 4-8 are "ftyp", brand list includes heic/heif/mif1/... */
export const isHeic = (buffer: Buffer) => {
  if (buffer.length < 12) return false;
  if (buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  const brands = buffer.subarray(8, Math.min(buffer.length, 64)).toString("latin1");
  return HEIC_BRANDS.test(brands);
};

export type DetectedImageKind = "jpeg" | "png" | "webp" | "gif" | "heic" | "pdf";

export const detectImageKind = (buffer: Buffer): DetectedImageKind | null => {
  if (isJpeg(buffer)) return "jpeg";
  if (isPng(buffer)) return "png";
  if (isWebp(buffer)) return "webp";
  if (isGif(buffer)) return "gif";
  if (isHeic(buffer)) return "heic";
  if (isPdf(buffer)) return "pdf";
  return null;
};

const mimeFromKind = (kind: DetectedImageKind): UploadMimeType | "image/heic" => {
  switch (kind) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "heic":
      return "image/heic";
    case "pdf":
      return "application/pdf";
  }
};

const normalizeDeclaredMime = (mimeType: string | undefined): string => {
  const raw = (mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (raw === "image/jpg") return "image/jpeg";
  if (raw === "image/heic-sequence" || raw === "image/heif-sequence") return "image/heic";
  if (raw === "image/heif") return "image/heic";
  return raw;
};

const isHeicHint = (mimeType: string | undefined, fileName: string | undefined) => {
  const declared = normalizeDeclaredMime(mimeType);
  const lower = (fileName ?? "").toLowerCase();
  return declared === "image/heic" || lower.endsWith(".heic") || lower.endsWith(".heif");
};

/**
 * Detects common image/PDF formats by magic bytes (preferred), or HEIC hints from MIME/filename.
 * Converts HEIC/HEIF to JPEG so OCR providers (OpenAI/Gemini) can consume them.
 */
export async function normalizeUploadImage(input: {
  buffer: Buffer;
  mimeType?: string;
  fileName?: string;
}): Promise<{ buffer: Buffer; mimeType: UploadMimeType; convertedFrom: string | null }> {
  let kind = detectImageKind(input.buffer);

  if (!kind && isHeicHint(input.mimeType, input.fileName)) {
    kind = "heic";
  }

  if (!kind) {
    throw Object.assign(
      new Error("Only JPEG, PNG, WebP, GIF, HEIC/HEIF images, or PDF documents are accepted."),
      { statusCode: 415 },
    );
  }

  const sourceMime = mimeFromKind(kind);

  if (kind === "heic") {
    try {
      const jpegBytes = await convert({
        buffer: new Uint8Array(input.buffer),
        format: "JPEG",
        quality: 0.92,
      });
      return {
        buffer: Buffer.from(jpegBytes),
        mimeType: "image/jpeg",
        convertedFrom: "image/heic",
      };
    } catch {
      throw Object.assign(
        new Error("Could not convert HEIC/HEIF image. Try exporting as JPEG from the phone."),
        { statusCode: 422 },
      );
    }
  }

  return {
    buffer: input.buffer,
    mimeType: sourceMime as UploadMimeType,
    convertedFrom: null,
  };
}
