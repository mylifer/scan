import {
  RECEIPT_USER_PROMPT,
  receiptJsonSchema,
  receiptSystemPrompt,
} from "@shared/services/vision/receiptPrompt";
import { parseReceiptJson } from "@shared/services/vision/parseReceiptJson";
import type { ReceiptData } from "@shared/types/receipt";
import { supabase } from "./supabase";

export interface ScanResult {
  data: ReceiptData;
  file?: File;
  previewUrl?: string;
}

/** Dosyayı base64'e çevirir (data: prefix olmadan) */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Fiş görselini (JPEG/PNG/PDF) yapay zeka ile okur.
 * Supabase Edge Function ("analyze-receipt") çağırır.
 */
export async function analyzeReceiptFile(file: File, signal?: AbortSignal): Promise<ReceiptData> {
  const mimeType = file.type === "application/pdf"
    ? "application/pdf"
    : file.type === "image/png"
      ? "image/png"
      : "image/jpeg";

  const base64 = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke("analyze-receipt", {
    body: {
      image: base64,
      mimeType,
      system: receiptSystemPrompt(),
      user: RECEIPT_USER_PROMPT,
      schema: receiptJsonSchema(),
    },
    signal,
  });

  if (error) {
    if (signal?.aborted) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Fiş yapay zeka ile okunamadı: ${msg}`);
  }

  if (!data?.text) {
    throw new Error("Yapay zeka analizinden boş yanıt döndü.");
  }

  return parseReceiptJson(data.text);
}
