"use client";

import { Avatar, Button, Dropdown, Kbd, Label, SearchField, Separator, toast, Tooltip } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import {
  Building2,
  CalendarClock,
  ChevronsUpDown,
  FileText,
  LogOut,
  Percent,
  PiggyBank,
  Plus,
  Receipt,
  ScanLine,
  Search,
  Settings,
  Tags,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Sidebar, useSidebar } from "@/components/layout/sidebar-shell";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/* "Yüzen Panel" kenar çubuğu: masaüstünde HeroUI Card içinde süzülür
   (kabuk: sidebar-shell.tsx), mobilde aynı içerik HeroUI Drawer'da açılır.
   Arama kutusu menüyü filtreler; ⌘K / Ctrl+K ile odaklanır. */

type NavItem = { href: string; title: string; icon: LucideIcon };

const NAV_GROUPS: NavItem[][] = [
  [
    { href: "/fisler", title: "Fişler", icon: Receipt },
    { href: "/efaturalar", title: "e-Faturalar", icon: FileText },
  ],
  [
    { href: "/kdv", title: "KDV Hesabı", icon: Percent },
    { href: "/vergi-takvimi", title: "Vergi Takvimi", icon: CalendarClock },
    { href: "/butce", title: "Bütçe Takibi", icon: PiggyBank },
  ],
  [
    { href: "/firmalar", title: "Firmalar", icon: Building2 },
    { href: "/kategoriler", title: "Kategoriler", icon: Tags },
  ],
];

const normalize = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();

export function AppSidebar() {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  const router = useRouter();
  const { session } = useAuth();
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const email = session?.user.email ?? "";
  const initial = (email[0] ?? "K").toLocaleUpperCase("tr-TR");
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const groups = useMemo(() => {
    const q = normalize(query);
    if (!q) return NAV_GROUPS;
    return NAV_GROUPS.map((g) => g.filter((it) => normalize(it.title).includes(q))).filter((g) => g.length);
  }, [query]);

  // ⌘K / Ctrl+K: arama kutusuna odaklan (daraltılmışsa önce genişlet)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (collapsed) toggleSidebar();
        window.setTimeout(() => searchRef.current?.focus(), collapsed ? 220 : 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, toggleSidebar]);

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const go = (href: string) => {
    setQuery("");
    closeMobile();
    router.push(`${href}/`);
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

  const logo = (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
      <ScanLine className="size-[18px]" />
    </span>
  );

  return (
    <Sidebar>
      {/* ── Uygulama menüsü (logo + açılır menü) ── */}
      <Dropdown>
        {collapsed ? (
          <Button variant="ghost" isIconOnly aria-label="FişTarayıcı menüsü" className="mx-auto">
            {logo}
          </Button>
        ) : (
          <Button variant="ghost" fullWidth className="justify-start gap-2.5">
            {logo}
            <span className="flex-1 truncate text-left font-semibold">FişTarayıcı</span>
            <ChevronsUpDown className="size-4 text-muted" />
          </Button>
        )}
        <Dropdown.Popover placement="bottom start" className="min-w-56">
          <Dropdown.Menu
            aria-label="Uygulama menüsü"
            onAction={(key) => {
              if (key === "yeni") go("/fisler/yeni");
              else if (key === "ayarlar") go("/ayarlar");
              else if (key === "cikis") void handleSignOut();
            }}
          >
            <Dropdown.Item id="yeni" textValue="Yeni fiş tara">
              <Plus className="size-4 shrink-0 text-muted" />
              <Label>Yeni fiş tara</Label>
            </Dropdown.Item>
            <Dropdown.Item id="ayarlar" textValue="Ayarlar">
              <Settings className="size-4 shrink-0 text-muted" />
              <Label>Ayarlar</Label>
            </Dropdown.Item>
            <Dropdown.Item id="cikis" textValue="Çıkış yap" variant="danger">
              <LogOut className="size-4 shrink-0" />
              <Label>Çıkış yap</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {/* ── Menüde ara (⌘K) ── */}
      {collapsed ? (
        <Tooltip delay={300}>
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Menüde ara"
            className="mx-auto"
            onPress={() => {
              toggleSidebar();
              window.setTimeout(() => searchRef.current?.focus(), 220);
            }}
          >
            <Search className="size-4" />
          </Button>
          <Tooltip.Content placement="right">Ara (⌘K)</Tooltip.Content>
        </Tooltip>
      ) : (
        <SearchField aria-label="Menüde ara" variant="secondary" fullWidth value={query} onChange={setQuery}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              ref={searchRef}
              className="min-w-0"
              placeholder="Ara…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && groups[0]?.[0]) go(groups[0][0].href);
              }}
            />
            {query ? (
              <SearchField.ClearButton />
            ) : (
              <Kbd className="me-2 shrink-0">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>K</Kbd.Content>
              </Kbd>
            )}
          </SearchField.Group>
        </SearchField>
      )}

      {/* ── Gezinme ── */}
      <nav aria-label="Ana menü" className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
        {groups.length === 0 && <p className="px-2.5 py-2 text-sm text-muted">Sonuç bulunamadı.</p>}
        {groups.map((group, gi) => (
          <div key={group[0].href} className="flex flex-col gap-0.5">
            {gi > 0 && <Separator className="my-2" />}
            {group.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const link = (
                <Link
                  href={`${item.href}/`}
                  onClick={() => {
                    setQuery("");
                    closeMobile();
                  }}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.title : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-xl text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus",
                    collapsed ? "mx-auto w-9 justify-center" : "px-2.5",
                    active
                      ? "bg-accent-soft font-medium text-accent-soft-foreground"
                      : "text-muted hover:bg-default hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.href} delay={300}>
                  <Tooltip.Trigger>{link}</Tooltip.Trigger>
                  <Tooltip.Content placement="right">{item.title}</Tooltip.Content>
                </Tooltip>
              ) : (
                <div key={item.href}>{link}</div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Yeni fiş ── */}
      {collapsed ? (
        <Tooltip delay={300}>
          <Tooltip.Trigger className="mx-auto">
            <Link
              href="/fisler/yeni/"
              aria-label="Yeni fiş tara"
              className={buttonVariants({ isIconOnly: true })}
            >
              <Plus className="size-4" />
            </Link>
          </Tooltip.Trigger>
          <Tooltip.Content placement="right">Yeni Fiş Tara</Tooltip.Content>
        </Tooltip>
      ) : (
        <Link href="/fisler/yeni/" onClick={closeMobile} className={buttonVariants({ fullWidth: true })}>
          <Plus className="size-4" />
          Yeni Fiş Tara
        </Link>
      )}

      {/* ── Kullanıcı satırı ── */}
      <Separator />
      <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
        <Avatar size="sm" className="shrink-0">
          <Avatar.Fallback>{initial}</Avatar.Fallback>
        </Avatar>
        {!collapsed && <span className="min-w-0 flex-1 truncate ps-1.5 text-sm text-muted">{email}</span>}
        <Tooltip delay={300}>
          <Tooltip.Trigger>
            <Link
              href="/ayarlar/"
              onClick={closeMobile}
              aria-label="Ayarlar"
              aria-current={isActive("/ayarlar") ? "page" : undefined}
              className={buttonVariants({ variant: "ghost", size: "sm", isIconOnly: true })}
            >
              <Settings className="size-4" />
            </Link>
          </Tooltip.Trigger>
          <Tooltip.Content placement={collapsed ? "right" : "top"}>Ayarlar</Tooltip.Content>
        </Tooltip>
        <Tooltip delay={300}>
          <Button variant="ghost" size="sm" isIconOnly aria-label="Çıkış yap" onPress={() => void handleSignOut()}>
            <LogOut className="size-4" />
          </Button>
          <Tooltip.Content placement={collapsed ? "right" : "top"}>Çıkış yap</Tooltip.Content>
        </Tooltip>
      </div>
    </Sidebar>
  );
}
