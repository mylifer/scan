import type { Metadata } from "next";
import { ReceiptForm } from "@/components/receipts/receipt-form";

export const metadata: Metadata = { title: "Yeni Fiş Ekle · Fiş Tarayıcı" };

export default function Page() {
  return <ReceiptForm />;
}
