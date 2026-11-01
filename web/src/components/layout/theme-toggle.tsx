"use client";

import { Button, Dropdown, Label, type Selection } from "@heroui/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const THEMES = [
  { id: "light", label: "Açık", icon: Sun },
  { id: "dark", label: "Koyu", icon: Moon },
  { id: "system", label: "Sistem", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const onSelectionChange = (keys: Selection) => {
    const next = keys === "all" ? undefined : [...keys][0];
    if (typeof next === "string") setTheme(next);
  };
  return (
    <Dropdown>
      <Button variant="ghost" size="sm" isIconOnly aria-label="Tema">
        <Sun className="size-4 dark:hidden transition-transform duration-200 hover:rotate-45" />
        <Moon className="hidden size-4 dark:block transition-transform duration-200 hover:-rotate-12" />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-40">
        <Dropdown.Menu
          aria-label="Tema"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([theme ?? "system"])}
          onSelectionChange={onSelectionChange}
        >
          {THEMES.map(({ id, label, icon: Icon }) => (
            <Dropdown.Item key={id} id={id} textValue={label}>
              <Icon className="size-4 shrink-0 text-muted" />
              <Label>{label}</Label>
              <Dropdown.ItemIndicator className="ms-auto" />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
