import type { Metadata } from "next";
import { FaturaKesView } from "@/components/fatura-kes/fatura-kes-view";

export const metadata: Metadata = { title: "Fatura Kes · Fiş Tarayıcı" };

export default function Page() {
  return <FaturaKesView />;
}
