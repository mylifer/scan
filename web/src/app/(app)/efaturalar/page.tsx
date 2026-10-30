import type { Metadata } from "next";
import { EFaturaView } from "@/components/efatura/efatura-view";

export const metadata: Metadata = { title: "e-Faturalar · Fiş Tarayıcı" };

export default function Page() {
  return <EFaturaView />;
}
