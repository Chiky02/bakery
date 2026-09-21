import { z } from "zod";

const ocrEnvSchema = z.object({
  OCR_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((value) => value === "true" || value === "1"),
  OCR_PROVIDER: z.enum(["openai", "gemini"]).default("gemini"),
  OCR_API_KEY: z.string().min(1).optional(),
  OCR_MODEL: z.string().min(1).optional(),
});

export const ocrEnv = ocrEnvSchema.parse({
  OCR_ENABLED: process.env.OCR_ENABLED || undefined,
  OCR_PROVIDER: process.env.OCR_PROVIDER || undefined,
  OCR_API_KEY: process.env.OCR_API_KEY || undefined,
  OCR_MODEL: process.env.OCR_MODEL || undefined,
});
