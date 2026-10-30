import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Ayarlar · Fiş Tarayıcı" };

export default function Page() {
  return <SettingsView />;
}
