import type { Metadata } from "next";
import { TaxCalendarView } from "@/components/tax/tax-calendar-view";

export const metadata: Metadata = { title: "Vergi Takvimi · Fiş Tarayıcı" };

export default function Page() {
  return <TaxCalendarView />;
}
