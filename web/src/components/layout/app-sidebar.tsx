"use client";

import { formatTL, monthRange } from "@shared/lib/format";
import {
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogOut,
  Percent,
  PiggyBank,
  Plus,
  Receipt,
  ScanLine,
  Settings,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { listReceipts } from "@/lib/receipts";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

interface NavGroup {
  label: string;
  items: {
    href: string;
    title: string;
    icon: LucideIcon;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Kayıtlar & Belgeler",
    items: [
      { href: "/fisler", title: "Fişler", icon: Receipt },
      { href: "/efaturalar", title: "e-Faturalar", icon: FileText },
    ],
  },
  {
    label: "Mali Analiz & Vergi",
    items: [
      { href: "/kdv", title: "KDV Hesabı", icon: Percent },
      { href: "/vergi-takvimi", title: "Vergi Takvimi", icon: CalendarClock },
      { href: "/butce", title: "Bütçe Takibi", icon: PiggyBank },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { href: "/firmalar", title: "Firmalar", icon: Building2 },
      { href: "/kategoriler", title: "Kategoriler", icon: Tags },
    ],
  },
];

/** Fintrack-tarzı Kenar Çubuğu Aylık Hızlı Özet Kartı */
function SidebarMonthlyCard() {
  const [stats, setStats] = useState<{ count: number; total: number } | null>(null);
  const currentMonth = useMemo(() => monthRange(0), []);

  useEffect(() => {
    let cancelled = false;
    void listReceipts({ from: currentMonth.from, to: currentMonth.to })
      .then((rows) => {
        if (!cancelled) {
          const total = rows.reduce((acc, r) => acc + r.toplam_tutar, 0);
          setStats({ count: rows.length, total });
        }
      })
      .catch(() => {
        // İsteğe bağlı hata durumu
      });

    return () => {
      cancelled = true;
    };
  }, [currentMonth.from, currentMonth.to]);

  if (!stats) return null;

  return (
    <div className="mx-2 mb-2 p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border/70 flex-shrink-0 space-y-1.5 transition-all">
      <div className="flex items-center justify-between text-[9.5px] font-bold tracking-[0.12em] uppercase text-muted-foreground">
        <span>Bu Ayki Fişler</span>
        <span className="text-primary font-semibold">{currentMonth.label}</span>
      </div>
      <div className="text-[17px] font-bold tabular-nums text-foreground">
        {formatTL(stats.total)} TL
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{stats.count} adet fiş</span>
        <Link href="/butce/" className="text-xs font-semibold text-primary hover:underline">
          Bütçe & Dağılım →
        </Link>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  const router = useRouter();
  const { session } = useAuth();
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const email = session?.user.email ?? "";
  const initial = (email[0] ?? "K").toUpperCase();
  const isSettingsActive = pathname === "/ayarlar" || pathname.startsWith("/ayarlar/");

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Oturum kapatıldı.");
      router.push("/login/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Çıkış yapılamadı.");
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar select-none">
      {/* ── Üst Logo & Başlık ── */}
      <SidebarHeader
        className={cn(
          "border-b border-sidebar-border/60 transition-all duration-200",
          isCollapsed
            ? "p-1.5 flex items-center justify-center"
            : "p-3 group-data-[collapsible=icon]:p-1.5 group-data-[collapsible=icon]:justify-center"
        )}
      >
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/fisler/"
                onClick={handleLinkClick}
                className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-all cursor-pointer shrink-0"
                aria-label="FişTarayıcı Ana Sayfa"
              >
                <ScanLine className="size-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">FişTarayıcı</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between w-full group-data-[collapsible=icon]:justify-center">
            <Link
              href="/fisler/"
              onClick={handleLinkClick}
              className="flex items-center gap-2.5 rounded-xl transition-all cursor-pointer p-1 hover:bg-sidebar-accent/50 min-w-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:gap-0"
            >
              <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-sm select-none shadow-xs shrink-0">
                <ScanLine className="size-5" />
              </div>
              <div className="flex flex-col leading-tight min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="font-bold text-[15px] tracking-tight text-foreground truncate">
                  Fiş<span className="text-primary">Tarayıcı</span>
                </span>
                <span className="text-[10.5px] font-medium text-muted-foreground mt-0.5 truncate">
                  Mali İşletme Portalı
                </span>
              </div>
            </Link>

            {isMobile && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpenMobile(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                aria-label="Menüyü kapat"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        )}
      </SidebarHeader>

      {/* ── Yeni Fiş Ekle Hızlı Aksiyon Butonu ── */}
      <div
        className={cn(
          "pt-3 pb-1 flex-shrink-0 transition-all",
          isCollapsed ? "px-1.5 flex justify-center" : "px-3 group-data-[collapsible=icon]:px-1.5"
        )}
      >
        {!isCollapsed ? (
          <Link
            href="/fisler/yeni/"
            onClick={handleLinkClick}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-primary text-primary-foreground font-semibold text-xs shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
          >
            <Plus className="size-4 shrink-0" />
            <span>Yeni Fiş Tara</span>
          </Link>
        ) : (
          <div className="flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/fisler/yeni/"
                  onClick={handleLinkClick}
                  className="flex items-center justify-center size-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="size-4 shrink-0" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Yeni Fiş Tara</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* ── Gruplanmış Navigasyon ── */}
      <SidebarContent
        className={cn(
          "py-2 space-y-3 overflow-y-auto transition-all",
          isCollapsed ? "px-1.5" : "px-2.5 group-data-[collapsible=icon]:px-1.5"
        )}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {!isCollapsed && (
              <div className="px-2.5 pt-2.5 pb-1 text-[9.5px] font-bold uppercase tracking-[0.13em] text-muted-foreground/80">
                {group.label}
              </div>
            )}

            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;

              if (isCollapsed) {
                return (
                  <div key={item.href} className="flex justify-center py-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`${item.href}/`}
                          onClick={handleLinkClick}
                          className={cn(
                            "flex size-9 items-center justify-center rounded-lg transition-colors cursor-pointer",
                            isActive
                              ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                          )}
                        >
                          <Icon className={cn("size-4.5 shrink-0", isActive && "text-primary")} />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={`${item.href}/`}
                  onClick={handleLinkClick}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[10px] text-[13px] font-medium transition-colors duration-150 cursor-pointer select-none",
                    isActive
                      ? "bg-primary/10 text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4.5 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="flex-1 truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </SidebarContent>

      {/* ── Footer: Durum Kartı + Profil + Ayarlar + Çıkış ── */}
      <SidebarFooter
        className={cn(
          "border-t border-sidebar-border/60 flex flex-col gap-1.5 flex-shrink-0 transition-all duration-200",
          isCollapsed ? "p-1.5" : "p-2.5 group-data-[collapsible=icon]:p-1.5"
        )}
      >
        {/* Canlı Aylık Özet Kartı */}
        {!isCollapsed && <SidebarMonthlyCard />}

        {!isCollapsed ? (
          <div className="space-y-1">
            {/* Kullanıcı Bilgisi */}
            {email && (
              <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-sidebar-accent/40 text-xs">
                <div className="size-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{email}</p>
                </div>
              </div>
            )}

            {/* Ayarlar ve Tema Butonu */}
            <div className="flex items-center gap-1">
              <Link
                href="/ayarlar/"
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-2 flex-1 px-2.5 py-2 rounded-[10px] text-[13px] font-medium transition-colors duration-150 cursor-pointer select-none",
                  isSettingsActive
                    ? "bg-primary/10 text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70"
                )}
              >
                <Settings
                  className={cn(
                    "size-4.5 shrink-0 transition-colors",
                    isSettingsActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span>Ayarlar</span>
              </Link>
              <ThemeToggle />
            </div>

            {/* Çıkış Yap */}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-[10px] text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
            >
              <LogOut className="size-4 shrink-0" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/ayarlar/"
                  onClick={handleLinkClick}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg transition-colors cursor-pointer",
                    isSettingsActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  <Settings className="size-4.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Ayarlar</TooltipContent>
            </Tooltip>
            <ThemeToggle />
          </div>
        )}

        {/* Masaüstü Kenar Çubuğu Daraltma Butonu */}
        {!isMobile && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn(
              "w-full text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent cursor-pointer",
              isCollapsed ? "justify-center px-0 h-9" : "justify-start gap-2 h-8"
            )}
            title={isCollapsed ? "Genişlet" : "Daralt"}
          >
            {isCollapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <>
                <ChevronLeft className="size-4" />
                <span>Kenar Çubuğunu Daralt</span>
              </>
            )}
          </Button>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
