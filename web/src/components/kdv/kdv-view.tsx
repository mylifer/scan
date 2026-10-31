"use client";

import { formatTL } from "@shared/lib/format";
import { kdvAyHesapla, type KdvAy } from "@shared/lib/kdvAy";
import type { ReceiptRecord } from "@shared/types/receipt";
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Info,
  Receipt,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDonemFaturalar, getMonthBounds, type EFatura } from "@/lib/efatura";
import { listReceiptsForKdv } from "@/lib/receipts";

export function KdvView() {
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [state, setState] = useState<{
    key: string;
    loading: boolean;
    gelen: EFatura[];
    giden: EFatura[];
    fisler: ReceiptRecord[];
    error: string | null;
  }>({
    key: "initial",
    loading: true,
    gelen: [],
    giden: [],
    fisler: [],
    error: null,
  });

  const monthInfo = useMemo(() => getMonthBounds(offset), [offset]);
  const activeKey = `${monthInfo.baslangic}`;
  const loading = state.key !== activeKey || state.loading;

  // Dönem verilerini çek
  useEffect(() => {
    let cancelled = false;

    // Fişler için bir sonraki ayın ilk günü
    const [y, m] = monthInfo.baslangic.split("-").map(Number);
    const nextY = m === 12 ? y! + 1 : y!;
    const nextM = m === 12 ? 1 : m! + 1;
    const to = `${nextY}-${String(nextM).padStart(2, "0")}-01`;

    void Promise.all([
      fetchDonemFaturalar("gelen", offset),
      fetchDonemFaturalar("giden", offset),
      listReceiptsForKdv({ from: monthInfo.baslangic, to }),
    ])
      .then(([gelenRes, gidenRes, fislerRes]) => {
        if (!cancelled) {
          setState({
            key: activeKey,
            loading: false,
            gelen: gelenRes.faturalar,
            giden: gidenRes.faturalar,
            fisler: fislerRes,
            error: null,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "KDV verileri yüklenemedi.";
          toast.error(msg);
          setState({
            key: activeKey,
            loading: false,
            gelen: [],
            giden: [],
            fisler: [],
            error: msg,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [offset, monthInfo.baslangic, activeKey]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const [y, m] = monthInfo.baslangic.split("-").map(Number);
    const nextY = m === 12 ? y! + 1 : y!;
    const nextM = m === 12 ? 1 : m! + 1;
    const to = `${nextY}-${String(nextM).padStart(2, "0")}-01`;

    try {
      const [gelenRes, gidenRes, fislerRes] = await Promise.all([
        fetchDonemFaturalar("gelen", offset, true),
        fetchDonemFaturalar("giden", offset, true),
        listReceiptsForKdv({ from: monthInfo.baslangic, to }),
      ]);
      setState({
        key: activeKey,
        loading: false,
        gelen: gelenRes.faturalar,
        giden: gidenRes.faturalar,
        fisler: fislerRes,
        error: null,
      });
      toast.success("KDV verileri güncellendi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi.");
    } finally {
      setRefreshing(false);
    }
  };

  // KDV hesaplaması
  const kdv = useMemo<KdvAy | null>(() => {
    if (state.key !== activeKey) return null;
    return kdvAyHesapla(state.gelen, state.giden, state.fisler, undefined, monthInfo.baslangic.slice(0, 7));
  }, [state.key, activeKey, state.gelen, state.giden, state.fisler, monthInfo.baslangic]);

  const isOdenecek = (kdv?.sonuc ?? 0) > 0;
  const isDevreden = (kdv?.sonuc ?? 0) < 0;

  return (
    <div className="space-y-6">
      {/* Başlık ve Ay Seçici */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="KDV Durumu"
          description="Giden faturalarda hesaplanan KDV ile gelen faturalar ve fişlerden düşülebilir KDV karşılaştırması."
        />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setOffset((o) => o - 1)}
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
              onClick={() => setOffset((o) => o + 1)}
              aria-label="Sonraki ay"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Ana Net KDV Sonuç Kartı */}
      <Card
        className={
          loading
            ? ""
            : isOdenecek
              ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10"
              : isDevreden
                ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10"
                : "border-muted"
        }
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <Calculator className="size-4" />
              {monthInfo.label} KDV Özeti
            </div>
            {!loading && kdv && (
              <Badge variant={isOdenecek ? "destructive" : isDevreden ? "secondary" : "outline"}>
                {isOdenecek ? "Tahmini Ödenecek KDV" : isDevreden ? "Sonraki Aya Devreden KDV" : "Sıfır Fark"}
              </Badge>
            )}
          </div>
          <CardTitle className="text-3xl font-bold tabular-nums">
            {loading ? (
              <Skeleton className="h-9 w-48" />
            ) : kdv ? (
              `${formatTL(Math.abs(kdv.sonuc))} TL`
            ) : (
              "—"
            )}
          </CardTitle>
          <CardDescription>
            {loading ? (
              <Skeleton className="h-4 w-72" />
            ) : isOdenecek ? (
              "Kestiğiniz faturalardaki KDV, indirilecek KDV'den fazla olduğu için bu tutarın devlete ödenmesi beklenir."
            ) : isDevreden ? (
              "İndirilecek KDV, hesaplanan KDV'den fazla olduğu için kalan tutar bir sonraki aya devreder."
            ) : (
              "Hesaplanan ve indirilecek KDV tutarları birbirine eşittir."
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* İki Sütunlu Ayrıntı: Kestiğim KDV vs Düşülebilir KDV */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sol Sütun: Kestiğim Faturalar (Hesaplanan KDV) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">1. Kestiğim Faturalar (Hesaplanan)</CardTitle>
              <TrendingUp className="size-4 text-amber-500" />
            </div>
            <CardDescription>Giden satış faturalarından doğan KDV yükümlülüğü</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm font-sans">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Faturada Yazan KDV:</span>
                <span className="font-medium tabular-nums">
                  {loading ? <Skeleton className="h-4 w-20" /> : `${formatTL(kdv?.kestigim.faturada ?? 0)} TL`}
                </span>
              </div>
              {(kdv?.kestigim.tevkifat ?? 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tevkifat Kesintisi (Alıcı öder):</span>
                  <span className="tabular-nums">
                    -{formatTL(kdv?.kestigim.tevkifat ?? 0)} TL
                  </span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Beyan Edilecek KDV:</span>
                <span className="tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-4 w-24" /> : `${formatTL(kdv?.kestigim.beyan ?? 0)} TL`}
                </span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Toplam <span className="font-semibold text-foreground">{kdv?.kestigim.adet ?? 0}</span> adet giden satış faturası dahil edildi.
            </div>
          </CardContent>
        </Card>

        {/* Sağ Sütun: Düşülebilir KDV (İndirilecek) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">2. Düşülebilir KDV (İndirilecek)</CardTitle>
              <TrendingDown className="size-4 text-emerald-500" />
            </div>
            <CardDescription>Alış faturaları ve taranan POS fişlerinden düşülecek KDV</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm font-sans">
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <FileSpreadsheet className="size-3.5" /> Gelen e-Faturalar ({kdv?.gelenEfatura.adet ?? 0}):
                </span>
                <span className="font-medium tabular-nums">
                  {loading ? <Skeleton className="h-4 w-20" /> : `${formatTL(kdv?.gelenEfatura.kdv ?? 0)} TL`}
                </span>
              </div>

              {/* Taranan POS Fişleri (Bu ayın fişleri) */}
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Receipt className="size-3.5" /> {(kdv?.fis.devredenler?.length ?? 0) > 0 ? `${monthInfo.label.split(" ")[0]} Fişleri` : "Taranan POS Fişleri"} ({kdv?.fis.buAyAdet ?? kdv?.fis.adet ?? 0}):
                </span>
                <span className="font-medium tabular-nums">
                  {loading ? <Skeleton className="h-4 w-20" /> : `${formatTL(kdv?.fis.buAyKdv ?? kdv?.fis.kdv ?? 0)} TL`}
                </span>
              </div>

              {/* Önceki aylardan devreden KDV kalemleri */}
              {kdv?.fis.devredenler?.map((d) => (
                <div key={d.ay} className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-amber-500" /> {d.etiket} ({d.adet}):
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatTL(d.kdv)} TL
                  </span>
                </div>
              ))}

              {(kdv?.iade.adet ?? 0) > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Kestiğim İadeler ({kdv?.iade.adet} adet):</span>
                  <span className="tabular-nums">
                    -{formatTL(kdv?.iade.kdv ?? 0)} TL
                  </span>
                </div>
              )}

              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Toplam Düşülebilir KDV:</span>
                <span className="tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-4 w-24" /> : `${formatTL(kdv?.dusulebilir ?? 0)} TL`}
                </span>
              </div>
            </div>

            {(kdv?.fis.eslesen ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5 text-primary shrink-0" />
                <span>
                  {kdv?.fis.eslesen} adet fiş gelen e-Faturayla mükerrer olmaması için otomatik hariç tutuldu.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hesaplama Açıklaması */}
      <Card size="sm" className="bg-muted/30">
        <CardContent className="space-y-2 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="size-4 text-primary" />
            KDV Hesabı Nasıl Yapılır?
          </div>
          <p>
            Hesaplanan KDV (Beyan) ile İndirilecek KDV (Gelen faturalar + Fişler − İadeler) arasındaki fark alınır.
            Muhasebeciye gönderilmemiş fişler mevcut ayda düşürülür; gönderilmeyenler sonraki aya devreder ve devreden KDV kalemi olarak listelenir.
            Muhasebeciye gönderilmiş fişler ise yalnızca işaretlendikleri ayın KDV indirimine dahil edilir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
