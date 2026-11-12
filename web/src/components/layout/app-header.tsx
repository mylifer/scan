"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/layout/sidebar-shell";
import { titleForPath } from "@/lib/nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { Breadcrumbs, Separator } from "@heroui/react";

export function AppHeader() {
  const title = titleForPath(usePathname());
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4 self-center" />
      <Breadcrumbs>
        <Breadcrumbs.Item className="font-medium text-foreground">{title}</Breadcrumbs.Item>
      </Breadcrumbs>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
