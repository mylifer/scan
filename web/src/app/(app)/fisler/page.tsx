import type { Metadata } from "next";
import { ReceiptsView } from "@/components/receipts/receipts-view";

export const metadata: Metadata = { title: "Fişler · Fiş Tarayıcı" };

export default function Page() {
  return <ReceiptsView />;
}
