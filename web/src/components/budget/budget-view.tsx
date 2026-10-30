"use client";

import { categoryLabel } from "@shared/lib/categories";
import { formatTL, monthRange, parseAmount } from "@shared/lib/format";
import { budgetStatus } from "@shared/lib/budgetMath";
import type { ReceiptRecord } from "@shared/types/receipt";
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  PieChart,
  Save,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setMonthlyBudget, useMonthlyBudget } from "@/lib/budget";
import { listReceipts } from "@/lib/receipts";

export function BudgetView() {
  const [offset, setOffset] = useState(0);
  const monthlyBudget = useMonthlyBudget();
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState("");

  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const monthInfo = useMemo(() => monthRange(offset), [offset]);

  // Fişleri çek
  useEffect(() => {
    let cancelled = false;

    void listReceipts({ from: monthInfo.from, to: monthInfo.to })
      .then((rows) => {
        if (!cancelled) setReceipts(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Fişler yüklenemedi.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [monthInfo.from, monthInfo.to]);

  // Harcama toplamı
  const totalSpent = useMemo(() => {
    return receipts.reduce((acc, r) => acc + r.toplam_tutar, 0);
  }, [receipts]);

  // Bütçe durumu
  const status = useMemo(() => {
    return budgetStatus(totalSpent, monthlyBudget ?? 0);
  }, [totalSpent, monthlyBudget]);

  // Kategori bazında dağılım
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const r of receipts) {
      const cur = map.get(r.kategori) ?? { total: 0, count: 0 };
      map.set(r.kategori, {
        total: cur.total + r.toplam_tutar,
        count: cur.count + 1,
      });
    }
    return Array.from(map.entries())
      .map(([kategori, val]) => ({
        kategori,
        label: categoryLabel(kategori),
        total: val.total,
        count: val.count,
        percent: totalSpent > 0 ? (val.total / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [receipts, totalSpent]);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseAmount(budgetValue);
    if (parsed <= 0) {
      setMonthlyBudget(null);
      toast.success("Aylık bütçe kaldırıldı.");
    } else {
      setMonthlyBudget(parsed);
      toast.success(`Aylık bütçe ${formatTL(parsed)} TL olarak güncellendi.`);
    }
    setEditingBudget(false);
  };

  const percentUsed = Math.min(Math.round(status.ratio * 100), 100);

  return (
    <div className="space-y-6">
      {/* Başlık ve Ay Seçici */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Bütçe Takibi"
          description="Aylık harcama hedefinizi belirleyin ve harcamalarınızı kategori bazında takip edin."
        />

        <div className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 shadow-xs">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setLoading(true);
              setOffset((o) => o - 1);
            }}
            aria-label="Önceki ay"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-28 text-center text-sm font-semibold">{monthInfo.label}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={offset >= 0}
            onClick={() => {
              setLoading(true);
              setOffset((o) => o + 1);
            }}
            aria-label="Sonraki ay"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Ana Bütçe İlerleme Kartı */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">Aylık Bütçe Durumu</CardTitle>
              {monthlyBudget ? (
                <Badge
                  variant={
                    status.level === "over"
                      ? "destructive"
                      : status.level === "warning"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {status.level === "over"
                    ? "Bütçe Aşıldı!"
                    : status.level === "warning"
                      ? "%80 Sınırı Aşıldı"
                      : "Bütçe Dahilinde"}
                </Badge>
              ) : (
                <Badge variant="outline">Bütçe Belirlenmedi</Badge>
              )}
            </div>
            <CardDescription>{monthInfo.label} dönemi toplam harcama ve bütçe analizi</CardDescription>
          </div>

          {!editingBudget ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBudgetValue(monthlyBudget ? String(monthlyBudget) : "");
                setEditingBudget(true);
              }}
              className="gap-1.5"
            >
              <Edit2 className="size-3.5" />
              {monthlyBudget ? "Bütçeyi Düzenle" : "Bütçe Belirle"}
            </Button>
          ) : (
            <form onSubmit={handleSaveBudget} className="flex items-center gap-2">
              <Input
                placeholder="Örn: 50.000"
                className="w-36 tabular-nums"
                value={budgetValue}
                onChange={(e) => setBudgetValue(e.target.value)}
                autoFocus
              />
              <Button type="submit" size="sm" className="gap-1">
                <Save className="size-3.5" />
                Kaydet
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingBudget(false)}
              >
                Vazgeç
              </Button>
            </form>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* İlerleme Çubuğu */}
          {monthlyBudget ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">
                  Harcanan: {loading ? "…" : `${formatTL(totalSpent)} TL`}
                </span>
                <span className="text-muted-foreground">
                  Hedef: {formatTL(monthlyBudget)} TL (%{Math.round(status.ratio * 100)})
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all duration-500 ${
                    status.level === "over"
                      ? "bg-destructive"
                      : status.level === "warning"
                        ? "bg-amber-500"
                        : "bg-primary"
                  }`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                {status.remaining > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Kalan Bütçe: {formatTL(status.remaining)} TL
                  </span>
                ) : (
                  <span className="text-destructive font-medium">
                    Aşılan Tutar: {formatTL(status.over)} TL
                  </span>
                )}
                <span>{receipts.length} adet fiş</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Henüz bir aylık bütçe belirlemediniz. &quot;Bütçe Belirle&quot; butonuna tıklayarak aylık gider hedefinizi girebilirsiniz.
            </div>
          )}

          {/* İstatistik Kutucukları */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Toplam Harcama</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {loading ? <Skeleton className="h-7 w-28" /> : `${formatTL(totalSpent)} TL`}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Fiş Sayısı</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {loading ? <Skeleton className="h-7 w-16" /> : `${receipts.length} adet`}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Ortalama Fiş Tutarı</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {loading ? (
                  <Skeleton className="h-7 w-24" />
                ) : receipts.length > 0 ? (
                  `${formatTL(totalSpent / receipts.length)} TL`
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kategori Dağılımı Tablosu */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PieChart className="size-4 text-primary" />
            <CardTitle className="text-base font-semibold">Kategori Bazında Harcamalar</CardTitle>
          </div>
          <CardDescription>Bu dönemdeki harcamalarınızın kategorilere göre dökümü</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[500px]">
            <TableHeader>
              <TableRow>
                <TableHead>Kategori</TableHead>
                <TableHead className="w-28 text-right">Fiş Sayısı</TableHead>
                <TableHead className="w-40 text-right">Toplam Harcama</TableHead>
                <TableHead className="w-48">Harcama Payı</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryBreakdown.map((item) => (
                <TableRow key={item.kategori}>
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {item.count} adet
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {formatTL(item.total)} TL
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.round(item.percent)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                        %{Math.round(item.percent)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && categoryBreakdown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                    Bu ay henüz kayıtlı fiş bulunmuyor.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
