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
import { useAuth } from "@/components/auth-provider";
import { Sidebar, useSidebar } from "@/components/layout/sidebar-shell";
import { listReceipts } from "@/lib/receipts";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { Button, Tooltip, toast } from "@heroui/react";

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
    <div className="mx-2 mb-2 p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border/70 flex-shrink-0 space-y-1.5 transition-all duration-200 animate-in fade-in-50">
      <div className="flex items-center justify-between text-[9.5px] font-bold tracking-[0.12em] uppercase text-muted">
        <span>Bu Ayki Fişler</span>
        <span className="text-accent font-semibold">{currentMonth.label}</span>
      </div>
      <div className="text-[17px] font-bold tabular-nums text-foreground">
        {formatTL(stats.total)}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>{stats.count} adet fiş</span>
        <Link href="/butce/" className="text-xs font-semibold text-accent hover:underline">
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
      toast.danger(err instanceof Error ? err.message : "Çıkış yapılamadı.");
    }
  };

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar select-none">
      {/* ── Üst Logo & Başlık ── */}
      <div
        className={cn(
          "border-b border-sidebar-border/60 transition-all duration-200",
          isCollapsed
            ? "p-1.5 flex items-center justify-center"
            : "p-3"
        )}
      >
        {isCollapsed ? (
          <Tooltip delay={300}>
            <Tooltip.Trigger>
              <Link
                href="/fisler/"
                onClick={handleLinkClick}
                className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-xs hover:bg-accent/90 transition-all cursor-pointer shrink-0"
                aria-label="FişTarayıcı Ana Sayfa"
              >
                <ScanLine className="size-5" />
              </Link>
            </Tooltip.Trigger>
            <Tooltip.Content placement="right">FişTarayıcı</Tooltip.Content>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between w-full">
            <Link
              href="/fisler/"
              onClick={handleLinkClick}
              className="flex items-center gap-2.5 rounded-xl transition-all cursor-pointer p-1 hover:bg-sidebar-accent/50 min-w-0"
            >
              <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground font-black text-sm select-none shadow-xs shrink-0">
                <ScanLine className="size-5" />
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-bold text-[15px] tracking-tight text-foreground truncate">
                  Fiş<span className="text-accent">Tarayıcı</span>
                </span>
                <span className="text-[10.5px] font-medium text-muted mt-0.5 truncate">
                  Mali İşletme Portalı
                </span>
              </div>
            </Link>

            {isMobile && (
              <Button
                type="button"
                variant="ghost"
                size="sm" isIconOnly
                onPress={() => setOpenMobile(false)}
                className="text-muted hover:text-foreground cursor-pointer shrink-0"
                aria-label="Menüyü kapat"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Yeni Fiş Ekle Hızlı Aksiyon Butonu ── */}
      <div
        className={cn(
          "pt-3 pb-1 flex-shrink-0 transition-all",
          isCollapsed ? "px-1.5 flex justify-center" : "px-3"
        )}
      >
        {!isCollapsed ? (
          <Link
            href="/fisler/yeni/"
            onClick={handleLinkClick}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-accent text-accent-foreground font-semibold text-xs shadow-xs hover:bg-accent/90 transition-all cursor-pointer"
          >
            <Plus className="size-4 shrink-0" />
            <span>Yeni Fiş Tara</span>
          </Link>
        ) : (
          <div className="flex justify-center">
            <Tooltip delay={300}>
              <Tooltip.Trigger>
                <Link
                  href="/fisler/yeni/"
                  onClick={handleLinkClick}
                  className="flex items-center justify-center size-9 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="size-4 shrink-0" />
                </Link>
              </Tooltip.Trigger>
              <Tooltip.Content placement="right">Yeni Fiş Tara</Tooltip.Content>
            </Tooltip>
          </div>
        )}
      </div>

      {/* ── Gruplanmış Navigasyon ── */}
      <div
        className={cn(
          "flex-1 min-h-0 py-2 space-y-3 overflow-y-auto transition-all",
          isCollapsed ? "px-1.5" : "px-2.5"
        )}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {!isCollapsed && (
              <div className="px-2.5 pt-2.5 pb-1 text-[9.5px] font-bold uppercase tracking-[0.13em] text-muted/80">
                {group.label}
              </div>
            )}

            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;

              if (isCollapsed) {
                return (
                  <div key={item.href} className="flex justify-center py-0.5">
                    <Tooltip delay={300}>
                      <Tooltip.Trigger>
                        <Link
                          href={`${item.href}/`}
                          onClick={handleLinkClick}
                          className={cn(
                            "flex size-9 items-center justify-center rounded-lg transition-all duration-150 active:scale-95 cursor-pointer",
                            isActive
                              ? "bg-accent/10 text-accent font-semibold shadow-2xs"
                              : "text-muted hover:bg-sidebar-accent hover:text-foreground"
                          )}
                        >
                          <Icon className={cn("size-4.5 shrink-0", isActive && "text-accent")} />
                        </Link>
                      </Tooltip.Trigger>
                      <Tooltip.Content placement="right">{item.title}</Tooltip.Content>
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
                    "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[10px] text-[13px] font-medium transition-all duration-150 active:scale-[0.98] cursor-pointer select-none",
                    isActive
                      ? "bg-accent/10 text-foreground font-semibold shadow-2xs"
                      : "text-muted hover:text-foreground hover:bg-sidebar-accent/70"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4.5 shrink-0 transition-colors",
                      isActive ? "text-accent" : "text-muted group-hover:text-foreground"
                    )}
                  />
                  <span className="flex-1 truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Footer: Durum Kartı + Profil + Ayarlar + Çıkış ── */}
      <div
        className={cn(
          "border-t border-sidebar-border/60 flex flex-col gap-1.5 flex-shrink-0 transition-all duration-200",
          isCollapsed ? "p-1.5" : "p-2.5"
        )}
      >
        {/* Canlı Aylık Özet Kartı */}
        {!isCollapsed && <SidebarMonthlyCard />}

        {!isCollapsed ? (
          <div className="space-y-1">
            {/* Kullanıcı Bilgisi */}
            {email && (
              <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-sidebar-accent/40 text-xs">
                <div className="size-6 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center shrink-0 text-[11px]">
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
                  "flex items-center gap-2 flex-1 px-2.5 py-2 rounded-[10px] text-[13px] font-medium transition-all duration-150 active:scale-[0.98] cursor-pointer select-none",
                  isSettingsActive
                    ? "bg-accent/10 text-foreground font-semibold shadow-2xs"
                    : "text-muted hover:text-foreground hover:bg-sidebar-accent/70"
                )}
              >
                <Settings
                  className={cn(
                    "size-4.5 shrink-0 transition-colors",
                    isSettingsActive ? "text-accent" : "text-muted"
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
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-[10px] text-xs font-medium text-muted hover:text-danger hover:bg-danger/10 transition-all duration-150 active:scale-[0.98] text-left cursor-pointer"
            >
              <LogOut className="size-4 shrink-0" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <Tooltip delay={300}>
              <Tooltip.Trigger>
                <Link
                  href="/ayarlar/"
                  onClick={handleLinkClick}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg transition-colors cursor-pointer",
                    isSettingsActive
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  <Settings className="size-4.5" />
                </Link>
              </Tooltip.Trigger>
              <Tooltip.Content placement="right">Ayarlar</Tooltip.Content>
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
            onPress={toggleSidebar}
            className={cn(
              "w-full text-xs text-muted hover:text-foreground hover:bg-sidebar-accent cursor-pointer",
              isCollapsed ? "justify-center px-0 h-9" : "justify-start gap-2 h-8"
            )}
            aria-label={isCollapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
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
      </div>

    </Sidebar>
  );
}
