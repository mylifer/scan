import type { Metadata } from "next";
import { CategoriesView } from "@/components/categories/categories-view";

export const metadata: Metadata = { title: "Kategoriler · Fiş Tarayıcı" };

export default function Page() {
  return <CategoriesView />;
}
