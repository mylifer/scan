"use client";

import { formatTL } from "@shared/lib/format";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchDetay, type EFatura, type FaturaDetay, type Yon } from "@/lib/efatura";

interface FaturaDetayDialogProps {
  fatura: EFatura | null;
  yon: Yon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPdf?: (fatura: EFatura) => void;
  onDetayLoaded?: (ettn: string, detay: FaturaDetay) => void;
}

function FaturaDetayContent({
  fatura,
  yon,
  open,
  onOpenChange,
  onOpenPdf,
  onDetayLoaded,
}: {
  fatura: EFatura;
  yon: Yon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPdf?: (fatura: EFatura) => void;
  onDetayLoaded?: (ettn: string, detay: FaturaDetay) => void;
}) {
  const [state, setState] = useState<{
    detay: FaturaDetay | null;
    loading: boolean;
    error: string | null;
  }>({
    detay: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    void fetchDetay(yon, fatura.ettn, fatura.tur)
      .then((res) => {
        if (!cancelled) {
          setState({ detay: res, loading: false, error: null });
          onDetayLoaded?.(fatura.ettn, res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Fatura detayları getirilemedi.";
          setState({ detay: null, loading: false, error: msg });
          toast.error(msg);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fatura.ettn, fatura.tur, yon, onDetayLoaded]);

  const handleRetry = () => {
    setState({ detay: null, loading: true, error: null });
    void fetchDetay(yon, fatura.ettn, fatura.tur)
      .then((res) => setState({ detay: res, loading: false, error: null }))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Fatura detayları getirilemedi.";
        setState({ detay: null, loading: false, error: msg });
        toast.error(msg);
      });
  };

  const currency = state.detay?.paraBirimi || fatura.paraBirimi || "TRY";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full max-w-[calc(100vw-2rem)] sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="border-b pb-4 pr-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="truncate text-base sm:text-lg font-semibold" title={fatura.belgeNo || fatura.ettn}>
                  Fatura Detayı · {fatura.belgeNo || fatura.ettn}
                </DialogTitle>
                {state.detay?.tip && <Badge variant="secondary">{state.detay.tip}</Badge>}
              </div>
              <DialogDescription className="break-all text-xs sm:text-sm text-muted-foreground">
                Tarih: {state.detay?.tarih || fatura.tarih} · ETTN: <span className="font-mono text-xs">{fatura.ettn}</span>
              </DialogDescription>
            </div>

            {onOpenPdf && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => onOpenPdf(fatura)}
                className="shrink-0 gap-1.5 shadow-xs"
              >
                <FileText className="size-4" />
                <span>PDF Görüntüle</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-6 overflow-y-auto pr-1 pt-2">
          {state.loading && (
            <div className="space-y-4 py-8">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-primary" />
                UBL faturası çözümleniyor…
              </div>
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          )}

          {state.error && !state.loading && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-destructive">Detaylar Yüklenemedi</p>
                <p className="max-w-md text-xs text-muted-foreground">{state.error}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
                <RefreshCw className="size-3.5" />
                Tekrar Dene
              </Button>
            </div>
          )}

          {state.detay && !state.loading && (
            <>
              {/* Taraflar Kartları */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card size="sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
                      Satıcı (Gönderen)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 space-y-1 text-sm">
                    <p className="font-medium text-foreground break-words">{state.detay.saticiUnvan || "—"}</p>
                    <p className="text-xs text-muted-foreground break-all">
                      VKN/TCKN: <span className="font-mono text-foreground">{state.detay.saticiVkn || "—"}</span>
                    </p>
                  </CardContent>
                </Card>

                <Card size="sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
                      Alıcı (Müşteri)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 space-y-1 text-sm">
                    <p className="font-medium text-foreground break-words">{state.detay.aliciUnvan || "—"}</p>
                    <p className="text-xs text-muted-foreground break-all">
                      VKN/TCKN: <span className="font-mono text-foreground">{state.detay.aliciVkn || "—"}</span>
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Kalemler Tablosu */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Fatura Kalemleri</h4>
                <div className="w-full overflow-x-auto rounded-lg border">
                  <Table className="w-full min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 pl-3">#</TableHead>
                        <TableHead className="min-w-48">Mal / Hizmet</TableHead>
                        <TableHead className="w-28 text-right">Miktar</TableHead>
                        <TableHead className="w-32 text-right">Birim Fiyat</TableHead>
                        <TableHead className="w-20 text-right">KDV %</TableHead>
                        <TableHead className="w-32 text-right">KDV Tutarı</TableHead>
                        <TableHead className="w-36 pr-3 text-right">Tutar (KDV Hariç)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.detay.kalemler.map((k, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="pl-3 text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium min-w-48 break-words">{k.ad}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums">
                            {k.miktar} {k.birim}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums">
                            {formatTL(k.birimFiyat)} {currency}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums">%{k.kdvOrani}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums">
                            {formatTL(k.kdvTutari)} {currency}
                          </TableCell>
                          <TableCell className="pr-3 text-right font-medium whitespace-nowrap tabular-nums">
                            {formatTL(k.tutar)} {currency}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* KDV Dağılımı ve Alt Toplamlar */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {/* KDV Dağılım Tablosu */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">KDV Dağılımı</h4>
                  <div className="w-full overflow-x-auto rounded-lg border">
                    <Table className="min-w-[280px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Oran</TableHead>
                          <TableHead className="text-right">Matrah</TableHead>
                          <TableHead className="text-right">KDV</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {state.detay.kdvler.map((kd, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">%{kd.oran}</TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {formatTL(kd.matrah)} {currency}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {formatTL(kd.tutar)} {currency}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Toplam Özeti Kartı */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">Tutar Özeti</h4>
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm font-sans">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ara Toplam (KDV Hariç):</span>
                      <span className="font-medium whitespace-nowrap tabular-nums text-foreground">
                        {formatTL(state.detay.araToplam)} {currency}
                      </span>
                    </div>
                    {state.detay.iskonto > 0 && (
                      <div className="flex justify-between text-destructive">
                        <span>İskonto:</span>
                        <span className="font-medium whitespace-nowrap tabular-nums">
                          -{formatTL(state.detay.iskonto)} {currency}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Toplam KDV:</span>
                      <span className="font-medium whitespace-nowrap tabular-nums text-foreground">
                        {formatTL(state.detay.kdvToplam)} {currency}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-base font-semibold">
                      <span>Ödenecek Toplam:</span>
                      <span className="whitespace-nowrap tabular-nums text-primary font-bold">
                        {formatTL(state.detay.odenecek)} {currency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Varsa Notlar */}
              {state.detay.notlar && state.detay.notlar.length > 0 && (
                <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3 text-xs">
                  <span className="font-semibold text-muted-foreground">Fatura Notları:</span>
                  <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                    {state.detay.notlar.map((not, i) => (
                      <li key={i}>{not}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FaturaDetayDialog({
  fatura,
  yon,
  open,
  onOpenChange,
  onOpenPdf,
  onDetayLoaded,
}: FaturaDetayDialogProps) {
  if (!open || !fatura) return null;
  return (
    <FaturaDetayContent
      key={fatura.ettn || fatura.belgeNo}
      fatura={fatura}
      yon={yon}
      open={open}
      onOpenChange={onOpenChange}
      onOpenPdf={onOpenPdf}
      onDetayLoaded={onDetayLoaded}
    />
  );
}
