"use client";

import {
  Archive,
  FileCode,
  Laptop,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Chip, Tabs, toast } from "@heroui/react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { supabase } from "@/lib/supabase";
import { BackupTab } from "./backup-tab";
import { ErrorLogTab } from "./error-log-tab";
import { TrashTab } from "./trash-tab";

export function SettingsView() {
  const { session } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      toast.success("Oturum kapatıldı.");
      router.push("/login");
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Çıkış yapılamadı.");
      setLoggingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ayarlar & Sistem"
        description="Hesabınızı yönetin, veri yedeklemesi yapın, silinen fişleri kurtarın ve sistem kayıtlarını inceleyin."
      />

      <Tabs defaultSelectedKey="genel" className="space-y-6">
        <Tabs.ListContainer className="w-full md:w-auto">
          <Tabs.List aria-label="Ayarlar" className="w-full md:w-auto">
            <Tabs.Tab id="genel" className="gap-2 whitespace-nowrap">
              <User className="size-4" />
              Genel
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="cop-kutusu" className="gap-2 whitespace-nowrap">
              <Trash2 className="size-4" />
              Çöp Kutusu
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="yedekleme" className="gap-2 whitespace-nowrap">
              <Archive className="size-4" />
              Yedekleme
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="hatalar" className="gap-2 whitespace-nowrap">
              <FileCode className="size-4" />
              Hata Günlüğü
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        {/* Genel Ayarlar Sekmesi */}
        <Tabs.Panel id="genel" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Profil / Oturum Kartı */}
            <Card>
              <Card.Header>
                <div className="flex items-center gap-2">
                  <User className="size-5 text-accent" />
                  <Card.Title>Hesap & Profil</Card.Title>
                </div>
                <Card.Description>Oturum açmış kullanıcı ve hesap bilgileri.</Card.Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <div className="rounded-lg border bg-default/30 p-3 space-y-1">
                  <span className="text-xs text-muted">E-posta Adresi</span>
                  <p className="font-semibold text-foreground text-sm">
                    {session?.user.email || "Giriş yapılmadı"}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Hesap Durumu:</span>
                  <Chip size="sm" variant="secondary" className="gap-1">
                    <ShieldCheck className="size-3" />
                    Aktif Oturum
                  </Chip>
                </div>

                <Button size="sm"
                  type="button"
                  variant="outline"
                  isDisabled={loggingOut}
                  onPress={handleSignOut}
                  className="w-full gap-2"
                >
                  <LogOut className="size-4" />
                  Oturumu Kapat
                </Button>
              </Card.Content>
            </Card>

            {/* Görünüm / Tema Kartı */}
            <Card>
              <Card.Header>
                <div className="flex items-center gap-2">
                  <Sun className="size-5 text-accent" />
                  <Card.Title>Görünüm ve Tema</Card.Title>
                </div>
                <Card.Description>
                  Web panelinizin temasını açık, koyu ya da sistem tercihinize göre ayarlayın.
                </Card.Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={theme === "light" ? "primary" : "outline"}
                    size="sm"
                    onPress={() => setTheme("light")}
                    fullWidth
                  >
                    <Sun className="size-4" />
                    Açık
                  </Button>
                  <Button
                    type="button"
                    variant={theme === "dark" ? "primary" : "outline"}
                    size="sm"
                    onPress={() => setTheme("dark")}
                    fullWidth
                  >
                    <Moon className="size-4" />
                    Koyu
                  </Button>
                  <Button
                    type="button"
                    variant={theme === "system" ? "primary" : "outline"}
                    size="sm"
                    onPress={() => setTheme("system")}
                    fullWidth
                  >
                    <Laptop className="size-4" />
                    Sistem
                  </Button>
                </div>

                <div className="rounded-lg border bg-default/40 p-3 text-xs text-muted">
                  <p className="font-semibold text-foreground">Sistem & Mimari</p>
                  <p className="mt-1">
                    Next.js 16 (App Router), React 19, Tailwind CSS v4 ve HeroUI ile masaüstü
                    hızında native web deneyimi.
                  </p>
                </div>
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>

        {/* Çöp Kutusu Sekmesi */}
        <Tabs.Panel id="cop-kutusu">
          <TrashTab />
        </Tabs.Panel>

        {/* Yedekleme Sekmesi */}
        <Tabs.Panel id="yedekleme">
          <BackupTab />
        </Tabs.Panel>

        {/* Hata Kayıtları Sekmesi */}
        <Tabs.Panel id="hatalar">
          <ErrorLogTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
