import type { Metadata } from "next";
import { KdvView } from "@/components/kdv/kdv-view";

export const metadata: Metadata = { title: "KDV Durumu · Fiş Tarayıcı" };

export default function Page() {
  return <KdvView />;
}
