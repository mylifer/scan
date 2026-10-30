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
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      toast.error(err instanceof Error ? err.message : "Çıkış yapılamadı.");
      setLoggingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ayarlar & Sistem"
        description="Hesabınızı yönetin, veri yedeklemesi yapın, silinen fişleri kurtarın ve sistem kayıtlarını inceleyin."
      />

      <Tabs defaultValue="genel" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-grid md:grid-cols-4">
          <TabsTrigger value="genel" className="gap-2">
            <User className="size-4" />
            Genel
          </TabsTrigger>
          <TabsTrigger value="cop-kutusu" className="gap-2">
            <Trash2 className="size-4" />
            Çöp Kutusu
          </TabsTrigger>
          <TabsTrigger value="yedekleme" className="gap-2">
            <Archive className="size-4" />
            Yedekleme
          </TabsTrigger>
          <TabsTrigger value="hatalar" className="gap-2">
            <FileCode className="size-4" />
            Hata Günlüğü
          </TabsTrigger>
        </TabsList>

        {/* Genel Ayarlar Sekmesi */}
        <TabsContent value="genel" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Profil / Oturum Kartı */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="size-5 text-primary" />
                  <CardTitle className="text-base font-semibold">Hesap & Profil</CardTitle>
                </div>
                <CardDescription>Oturum açmış kullanıcı ve hesap bilgileri.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">E-posta Adresi</span>
                  <p className="font-semibold text-foreground text-sm">
                    {session?.user.email || "Giriş yapılmadı"}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Hesap Durumu:</span>
                  <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="size-3" />
                    Aktif Oturum
                  </Badge>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={loggingOut}
                  onClick={handleSignOut}
                  className="w-full gap-2 text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="size-4" />
                  Oturumu Kapat
                </Button>
              </CardContent>
            </Card>

            {/* Görünüm / Tema Kartı */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sun className="size-5 text-primary" />
                  <CardTitle className="text-base font-semibold">Görünüm ve Tema</CardTitle>
                </div>
                <CardDescription>
                  Web panelinizin temasını açık, koyu ya da sistem tercihinize göre ayarlayın.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                    className="flex flex-col h-auto py-3 gap-1.5"
                  >
                    <Sun className="size-4" />
                    <span className="text-xs">Açık</span>
                  </Button>
                  <Button
                    type="button"
                    variant={theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className="flex flex-col h-auto py-3 gap-1.5"
                  >
                    <Moon className="size-4" />
                    <span className="text-xs">Koyu</span>
                  </Button>
                  <Button
                    type="button"
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                    className="flex flex-col h-auto py-3 gap-1.5"
                  >
                    <Laptop className="size-4" />
                    <span className="text-xs">Sistem</span>
                  </Button>
                </div>

                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Sistem & Mimari</p>
                  <p className="mt-1">
                    Next.js 16 (App Router), React 19, Tailwind CSS v4 ve shadcn UI ile masaüstü
                    hızında native web deneyimi.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Çöp Kutusu Sekmesi */}
        <TabsContent value="cop-kutusu">
          <TrashTab />
        </TabsContent>

        {/* Yedekleme Sekmesi */}
        <TabsContent value="yedekleme">
          <BackupTab />
        </TabsContent>

        {/* Hata Kayıtları Sekmesi */}
        <TabsContent value="hatalar">
          <ErrorLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
