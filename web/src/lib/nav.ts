import {
  CalendarClock,
  Building2,
  FileText,
  Percent,
  PiggyBank,
  Receipt,
  Settings,
  Tags,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; title: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/fisler", title: "Fişler", icon: Receipt },
  { href: "/efaturalar", title: "e-Faturalar", icon: FileText },
  { href: "/kdv", title: "KDV", icon: Percent },
  { href: "/vergi-takvimi", title: "Vergi Takvimi", icon: CalendarClock },
  { href: "/firmalar", title: "Firmalar", icon: Building2 },
  { href: "/kategoriler", title: "Kategoriler", icon: Tags },
  { href: "/butce", title: "Bütçe", icon: PiggyBank },
  { href: "/ayarlar", title: "Ayarlar", icon: Settings },
];

/** Yol adından (sondaki / dahil) sayfa başlığı. */
export function titleForPath(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return NAV_ITEMS.find((i) => clean === i.href || clean.startsWith(i.href + "/"))?.title ?? "Fişler";
}
