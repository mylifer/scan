import type { Metadata } from "next";
import { BudgetView } from "@/components/budget/budget-view";

export const metadata: Metadata = { title: "Bütçe Takibi · Fiş Tarayıcı" };

export default function Page() {
  return <BudgetView />;
}
