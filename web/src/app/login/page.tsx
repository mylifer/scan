"use client";

import { ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { Button, Card, Input, Label } from "@heroui/react";

export default function LoginPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) router.replace("/fisler/");
  }, [session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message === "Invalid login credentials" ? "E-posta veya şifre hatalı." : error.message);
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-default/40 p-4">
      <Card className="w-full max-w-sm">
        <Card.Header className="items-center text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <ScanLine className="size-5" />
          </div>
          <Card.Title>Fiş Tarayıcı</Card.Title>
          <Card.Description>Hesabınıza giriş yapın</Card.Description>
        </Card.Header>
        <Card.Content>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Şifre</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {!supabaseConfigured && <p className="text-sm text-danger">Supabase ayarları eksik (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).</p>}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button size="sm" type="submit" isDisabled={busy}>{busy ? "Giriş yapılıyor…" : "Giriş yap"}</Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
