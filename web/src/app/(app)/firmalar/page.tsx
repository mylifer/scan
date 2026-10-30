import type { Metadata } from "next";
import { FirmsView } from "@/components/firms/firms-view";

export const metadata: Metadata = { title: "Firmalar · Fiş Tarayıcı" };

export default function Page() {
  return <FirmsView />;
}
