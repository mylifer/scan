"use client";

import { FileText, Percent, PiggyBank, Receipt, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const MOBILE_ITEMS = [
  { href: "/fisler", label: "Fişler", icon: Receipt },
  { href: "/efaturalar", label: "e-Fatura", icon: FileText },
  { href: "/kdv", label: "KDV", icon: Percent },
  { href: "/butce", label: "Bütçe", icon: PiggyBank },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname().replace(/\/+$/, "") || "/";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden pb-safe">
      <div className="flex h-14 items-center justify-around px-2">
        {MOBILE_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={`${item.href}/`}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center py-1.5 transition-colors cursor-pointer",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-0 h-0.5 w-6 rounded-full bg-primary" />
              )}
              <Icon className="size-5 shrink-0" />
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
