"use client";

import { formatTL } from "@shared/lib/format";
import {
  olaganDisi,
  ozetle,
  type DonemOzet,
  type OlaganDisi,
} from "@shared/lib/efaturaOzet";
import type { TutarSatiri } from "@shared/services/efatura/qnbEfatura";
import { AlertCircle, FileSpreadsheet } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportExcel, type EFatura, type Yon } from "@/lib/efatura";

interface DonemOzetDialogProps {
  faturalar: EFatura[];
  periodLabel: string;
  yon: Yon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DonemOzetDialog({
  faturalar,
  periodLabel,
  yon,
  open,
  onOpenChange,
}: DonemOzetDialogProps) {
  const tutarSatirlari = useMemo<TutarSatiri[]>(() => {
    return faturalar.map((f) => ({
      ettn: f.ettn,
      belgeNo: f.belgeNo,
      tarih: f.tarih,
      vkn: f.vkn,
      matrah: f.matrah ?? Math.max(0, f.tutar - (f.kdv ?? 0)),
      kdv: f.kdv ?? 0,
      tevkifat: 0,
      odenecek: f.tutar,
      paraBirimi: f.paraBirimi,
      oranlar: (f.kdv ? { "20": f.kdv } : {}) as Record<string, number>,
      tip: f.tip,
    }));
  }, [faturalar]);

  const ozet = useMemo<DonemOzet>(() => {
    const gelen = yon === "gelen" ? tutarSatirlari : [];
    const giden = yon === "giden" ? tutarSatirlari.filter((t) => t.tip !== "earsiv") : [];
    const earsiv = yon === "giden" ? faturalar.filter((f) => f.tur === "earsiv") : [];

    const res = ozetle(gelen, giden, earsiv);
    return res.genel;
  }, [tutarSatirlari, faturalar, yon]);

  const olaganDisiList = useMemo<OlaganDisi[]>(() => {
    return olaganDisi(tutarSatirlari, 5);
  }, [tutarSatirlari]);

  const handleExport = () => {
    exportExcel(faturalar, periodLabel, yon);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100vw-2rem)] sm:max-w-4xl flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="border-b pb-4 pr-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="break-words text-base sm:text-lg font-semibold">
                {periodLabel} · Dönem Özeti ({yon === "gelen" ? "Gelen e-Faturalar" : "Giden e-Faturalar"})
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                Bu dönemdeki faturaların matrah ve vergi toplamları
              </DialogDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="shrink-0 gap-1.5"
            >
              <FileSpreadsheet className="size-4" />
              Excel İndir
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-6 overflow-y-auto pr-1 pt-2">
          {/* Özet Kartları */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryBlock
              title="KDV Hariç Matrah"
              tutar={yon === "gelen" ? ozet.gelen.matrah : ozet.satis.matrah + ozet.earsiv.matrah}
              sub={`${yon === "gelen" ? ozet.gelen.adet : ozet.satis.adet + ozet.earsiv.adet} adet fatura`}
            />
            <SummaryBlock
              title="Toplam KDV"
              tutar={yon === "gelen" ? ozet.gelen.kdv : ozet.satis.kdv + ozet.earsiv.kdv}
              sub={yon === "gelen" ? "İndirilecek KDV" : "Hesaplanan KDV"}
            />
            <SummaryBlock
              title="Genel Toplam (Ödenecek)"
              tutar={yon === "gelen" ? ozet.gelen.tutar : ozet.satis.tutar + ozet.earsiv.tutar}
              sub="KDV dahil"
              highlight
            />
          </div>

          {/* Giden Fatura Tipleri Ayrımı */}
          {yon === "giden" && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Fatura Dağılımı</h4>
              <div className="w-full overflow-x-auto rounded-lg border">
                <Table className="min-w-[520px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fatura Türü</TableHead>
                      <TableHead className="text-right">Adet</TableHead>
                      <TableHead className="text-right">Matrah</TableHead>
                      <TableHead className="text-right">KDV</TableHead>
                      <TableHead className="text-right">Toplam Tutar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">e-Fatura Satış</TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">{ozet.satis.adet}</TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">{formatTL(ozet.satis.matrah)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">{formatTL(ozet.satis.kdv)}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatTL(ozet.satis.tutar)}</TableCell>
                    </TableRow>
                    {ozet.iade.adet > 0 && (
                      <TableRow className="text-destructive">
                        <TableCell className="font-medium">İadeler</TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">{ozet.iade.adet}</TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">-{formatTL(ozet.iade.matrah)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">-{formatTL(ozet.iade.kdv)}</TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">-{formatTL(ozet.iade.tutar)}</TableCell>
                      </TableRow>
                    )}
                    {ozet.earsiv.adet > 0 && (
                      <TableRow>
                        <TableCell className="font-medium">e-Arşiv Fatura</TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">{ozet.earsiv.adet}</TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">{formatTL(ozet.earsiv.matrah)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">{formatTL(ozet.earsiv.kdv)}</TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatTL(ozet.earsiv.tutar)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Olağan Dışı Yüksek Tutarlı Faturalar */}
          {olaganDisiList.length > 0 && (
            <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                Olağan Dışı Yüksek Tutarlı Faturalar
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Aşağıdaki faturaların matrahı bu dönemdeki faturaların ortanca matrahının 5 katından yüksektir:
              </p>
              <div className="space-y-1.5">
                {olaganDisiList.map((od) => (
                  <div
                    key={od.ettn}
                    className="flex flex-wrap items-center justify-between rounded border bg-card p-2 text-xs"
                  >
                    <div>
                      <span className="font-medium">{od.belgeNo || od.ettn}</span> · {od.tarih}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{formatTL(od.matrah)} TL</span>
                      <Badge variant="outline" className="text-[10px]">
                        {od.kat}× ortalama
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryBlock({
  title,
  tutar,
  sub,
  highlight,
}: {
  title: string;
  tutar: number;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <Card size="sm" className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardHeader className="pb-2">
        <p className="text-xs text-muted-foreground">{title}</p>
        <CardTitle className="text-xl tabular-nums">{formatTL(tutar)} TL</CardTitle>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardHeader>
    </Card>
  );
}
