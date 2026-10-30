"use client";

import {
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Percent,
  PiggyBank,
  Receipt,
  ScanLine,
  Settings,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

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
    label: "KAYITLAR",
    items: [
      { href: "/fisler", title: "Fişler", icon: Receipt },
      { href: "/efaturalar", title: "e-Faturalar", icon: FileText },
    ],
  },
  {
    label: "MALİ ANALİZ",
    items: [
      { href: "/kdv", title: "KDV", icon: Percent },
      { href: "/vergi-takvimi", title: "Vergi Takvimi", icon: CalendarClock },
      { href: "/butce", title: "Bütçe", icon: PiggyBank },
    ],
  },
  {
    label: "YÖNETİM",
    items: [
      { href: "/firmalar", title: "Firmalar", icon: Building2 },
      { href: "/kategoriler", title: "Kategoriler", icon: Tags },
      { href: "/ayarlar", title: "Ayarlar", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* Header / Logo */}
      <SidebarHeader className="border-b border-sidebar-border/60 p-3">
        <div className="flex items-center justify-between">
          <Link
            href="/fisler/"
            onClick={handleLinkClick}
            className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-sidebar-accent"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <ScanLine className="size-4.5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col leading-none">
                <span className="font-bold text-sm tracking-tight text-foreground">
                  Fiş <span className="text-primary">Tarayıcı</span>
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Masaüstü Panel</span>
              </div>
            )}
          </Link>

          {isMobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpenMobile(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Menüyü kapat"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      {/* Menü Grupları */}
      <SidebarContent className="px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            {!isCollapsed && (
              <SidebarGroupLabel className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={isActive}
                        className={cn(
                          "relative rounded-lg px-2.5 py-2 font-medium transition-all duration-150 cursor-pointer",
                          isActive
                            ? "bg-primary/10 text-foreground font-semibold shadow-2xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-primary"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                        )}
                      >
                        <Link href={`${item.href}/`} onClick={handleLinkClick}>
                          <Icon className={cn("size-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover/menu-button:text-foreground")} />
                          {!isCollapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer: Daraltma Butonu & Versiyon */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-2">
        {!isMobile && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn(
              "w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent cursor-pointer",
              isCollapsed && "justify-center px-0"
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
