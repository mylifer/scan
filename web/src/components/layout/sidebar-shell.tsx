"use client";

import { Button, Drawer } from "@heroui/react";
import { PanelLeftIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/* Uygulama kenar çubuğu kabuğu — HeroUI'de hazır bir sidebar bileşeni yok.
   Masaüstünde daraltılabilir sabit bir <aside>, mobilde HeroUI Drawer kullanır.
   Daraltma tercihi çerezde saklanır; Ctrl/⌘+B ile aç/kapa. */

const COOKIE_NAME = "sidebar_state";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const KEYBOARD_SHORTCUT = "b";

type SidebarContextValue = {
  state: "expanded" | "collapsed";
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar yalnız SidebarProvider içinde kullanılabilir.");
  return ctx;
}

function readCookie(): boolean {
  if (typeof document === "undefined") return true;
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=(true|false)`));
  return m ? m[1] === "true" : true;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [open, setOpenState] = useState(readCookie);
  const [openMobile, setOpenMobile] = useState(false);

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}`;
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isMobile) setOpenMobile((o) => !o);
    else setOpen(!open);
  }, [isMobile, open, setOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === KEYBOARD_SHORTCUT && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const value = useMemo<SidebarContextValue>(
    () => ({ state: open ? "expanded" : "collapsed", isMobile, openMobile, setOpenMobile, toggleSidebar }),
    [open, isMobile, openMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div className="flex min-h-svh w-full">{children}</div>
    </SidebarContext.Provider>
  );
}

/** Masaüstünde sabit kenar çubuğu, mobilde soldan açılan HeroUI Drawer. */
export function Sidebar({ className, children }: { className?: string; children: React.ReactNode }) {
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar();

  if (isMobile) {
    return (
      <Drawer.Backdrop isOpen={openMobile} onOpenChange={setOpenMobile}>
        <Drawer.Content placement="left" className="w-72 max-w-[85vw]">
          <Drawer.Dialog aria-label="Gezinme menüsü" className={cn("flex h-full flex-col p-0", className)}>
            {children}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    );
  }

  const width = state === "collapsed" ? "w-14" : "w-64";
  return (
    <>
      {/* Akıştaki yer tutucu: içerik alanı kenar çubuğu genişliği kadar kayar */}
      <div aria-hidden className={cn("hidden shrink-0 transition-[width] duration-200 md:block", width)} />
      <aside
        data-state={state}
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden h-svh flex-col transition-[width] duration-200 md:flex",
          width,
          className,
        )}
      >
        {children}
      </aside>
    </>
  );
}

export function SidebarInset({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("relative flex w-full flex-1 flex-col bg-background", className)}>{children}</div>;
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      className={cn("size-7", className)}
      aria-label="Kenar çubuğunu aç/kapat"
      onPress={toggleSidebar}
    >
      <PanelLeftIcon className="size-4" />
    </Button>
  );
}
