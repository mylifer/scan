import { supabase } from "./supabase";

export interface AppErrorRecord {
  id: number;
  created_at: string;
  context: string;
  message: string;
  detail: string | null;
  app_version: string | null;
  platform: string | null;
}

const TABLE = "app_errors";

/** Son hata kayıtlarını çeker */
export async function listErrors(limit = 100): Promise<AppErrorRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    throw new Error(`Hata kayıtları yüklenemedi: ${error.message}`);
  }

  return (data ?? []) as AppErrorRecord[];
}

/** Tüm hata kayıtlarını siler */
export async function clearErrors(): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().gte("id", 0);
  if (error) {
    throw new Error(`Hata kayıtları silinemedi: ${error.message}`);
  }
}
