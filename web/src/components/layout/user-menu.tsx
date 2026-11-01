"use client";

import { Avatar, Button, Dropdown, Header, Label } from "@heroui/react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";

export function UserMenu() {
  const { session } = useAuth();
  const email = session?.user.email ?? "";
  return (
    <Dropdown>
      <Button variant="ghost" size="sm" isIconOnly aria-label="Kullanıcı menüsü">
        <Avatar size="sm" className="size-7">
          <Avatar.Fallback className="text-xs">{(email[0] ?? "?").toUpperCase()}</Avatar.Fallback>
        </Avatar>
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-56">
        <Dropdown.Menu aria-label="Kullanıcı menüsü" onAction={(key) => key === "logout" && void supabase.auth.signOut()}>
          <Dropdown.Section>
            <Header className="truncate font-normal text-muted">{email}</Header>
            <Dropdown.Item id="logout" textValue="Çıkış">
              <LogOut className="size-4 shrink-0 text-muted" />
              <Label>Çıkış</Label>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
