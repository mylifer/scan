"use client";

import {
  AlertTriangle,
  Check,
  FileCode,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clearErrors, listErrors, type AppErrorRecord } from "@/lib/errorLog";

export function ErrorLogTab() {
  const [errors, setErrors] = useState<AppErrorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<AppErrorRecord | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchErrors = () => {
    void listErrors()
      .then((data) => setErrors(data))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Hata kayıtları yüklenemedi.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await clearErrors();
      setErrors([]);
      setClearDialogOpen(false);
      toast.success("Hata kayıtları temizlendi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Temizlenemedi.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">Uygulama Hata Kayıtları</CardTitle>
            <CardDescription>
              Uygulama çalışırken karşılaşılan beklenmedik durumlar ve sistem kayıtları burada listelenir.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                fetchErrors();
              }}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Yenile
            </Button>
            {errors.length > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setClearDialogOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Kayıtları Temizle ({errors.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : errors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Check className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">Hata kaydı bulunmuyor</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tüm servisler sorunsuz çalışıyor.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih & Saat</TableHead>
                    <TableHead>Bağlam</TableHead>
                    <TableHead>Mesaj</TableHead>
                    <TableHead>Platform / Sürüm</TableHead>
                    <TableHead className="text-right">Detay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((err) => (
                    <TableRow key={err.id}>
                      <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                        {err.created_at ? new Date(err.created_at).toLocaleString("tr-TR") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {err.context || "genel"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate font-medium text-xs text-foreground">
                        {err.message}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {[err.platform, err.app_version].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedError(err)}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <FileCode className="size-3" />
                          İncele
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detay Dialogu */}
      <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" />
              Hata Detayı
            </DialogTitle>
            <DialogDescription>
              Bağlam: <span className="font-semibold">{selectedError?.context}</span> · Tarih:{" "}
              {selectedError?.created_at ? new Date(selectedError.created_at).toLocaleString("tr-TR") : "—"}
            </DialogDescription>
          </DialogHeader>

          {selectedError && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                <span className="font-semibold text-foreground">Hata Mesajı:</span>
                <p className="font-mono text-destructive">{selectedError.message}</p>
              </div>

              {selectedError.detail ? (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Teknik Detay (Stack Trace):</span>
                  <pre className="max-h-60 overflow-auto rounded-lg border bg-muted/60 p-3 font-mono text-xs text-foreground/90 whitespace-pre-wrap">
                    {selectedError.detail}
                  </pre>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Ek teknik detay bulunmuyor.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Kayıtları Temizle Onayı */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hata Kayıtlarını Temizle</AlertDialogTitle>
            <AlertDialogDescription>
              {errors.length} adet hata kaydı kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              disabled={clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Temizleniyor…
                </>
              ) : (
                "Kayıtları Temizle"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
