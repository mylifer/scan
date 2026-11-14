"use client";

import { formatTL } from "@shared/lib/format";
import { ayEkle, devredenFisAylari, kdvAyHesapla, type KdvAy } from "@shared/lib/kdvAy";
import { FIS_TIMEOUT_MS, kdvVerileriniGetir, oncekiGelenleriGetir } from "@shared/lib/kdvYukle";
import { withTimeout } from "@shared/lib/retry";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Chip, Skeleton, Spinner, toast } from "@heroui/react";
import { PageHeader } from "@/components/layout/page-header";
import { fetchDonemFaturalar, getMonthBounds, readPersistedDonem, type EFatura } from "@/lib/efatura";
import { listReceiptsForKdv } from "@/lib/receipts";

/** "2026-09" ayının bu aya göre offset'i (getMonthBounds / önbellek anahtarları offset ile çalışır) */
function ayOffset(ay: string): number {
  const simdi = getMonthBounds(0).baslangic.slice(0, 7);
  const [y1, m1] = ay.split("-").map(Number);
  const [y2, m2] = simdi.split("-").map(Number);
  return (y1! - y2!) * 12 + (m1! - m2!);
}

/** Devreden fişlerin aylarının tarayıcıda kayıtlı gelen e-Faturaları */
function kayitliOnceki(ay: string): EFatura[] | null {
  return readPersistedDonem("gelen", ayOffset(ay))?.data.faturalar ?? null;
}

export function KdvView() {
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [state, setState] = useState<{
    key: string;
    loading: boolean;
    gelen: EFatura[];
    giden: EFatura[];
    fisler: ReceiptRecord[];
    /** Devreden fişlerin kendi aylarındaki gelen e-Faturalar (yalnızca eşleştirme için) */
    oncekiGelen: EFatura[];
    error: string | null;
    /** e-Faturalar QNB'den güncelleniyor ya da alınamadı; `at`: gösterilen kayıtlı sonucun zamanı */
    qnb: { durum: "yukleniyor" | "hata"; at: number | null; mesaj?: string } | null;
  }>({
    key: "initial",
    loading: true,
    gelen: [],
    giden: [],
    fisler: [],
    oncekiGelen: [],
    error: null,
    qnb: null,
  });

  const monthInfo = useMemo(() => getMonthBounds(offset), [offset]);
  const activeKey = `${monthInfo.baslangic}`;
  const loading = state.key !== activeKey || state.loading;
  // "Yenile" sürerken ay değişirse eski ayın sonucu yeni ayın yerine yazılmasın
  const activeKeyRef = useRef(activeKey);
  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  // Dönem verilerini çek
  const yukleKdv = useCallback(async (force: boolean, iptal: () => boolean = () => false) => {
    const key = activeKey;
    const to = `${ayEkle(monthInfo.baslangic.slice(0, 7), 1)}-01`;
    const kGelen = readPersistedDonem("gelen", offset);
    const kGiden = readPersistedDonem("giden", offset);
    const kayitliAt = kGelen && kGiden ? Math.min(kGelen.at, kGiden.at) : null;
    try {
      const fisler = await withTimeout(listReceiptsForKdv({ from: monthInfo.baslangic, to }), FIS_TIMEOUT_MS, "Fiş sorgusu");
      if (iptal()) return;
      // Devreden fişler kendi aylarının e-Faturalarıyla eşleştirilir (aynı KDV iki kez indirilmesin)
      const oncekiAylar = devredenFisAylari(fisler, monthInfo.baslangic.slice(0, 7));
      setState({
        key,
        loading: false,
        gelen: kGelen?.data.faturalar ?? [],
        giden: kGiden?.data.faturalar ?? [],
        fisler,
        oncekiGelen: oncekiAylar.flatMap((m) => kayitliOnceki(m) ?? []),
        error: null,
        qnb: { durum: "yukleniyor", at: kayitliAt },
      });
      const [v, onceki] = await Promise.all([
        kdvVerileriniGetir({
          gelen: () => fetchDonemFaturalar("gelen", offset, force),
          giden: () => fetchDonemFaturalar("giden", offset, force),
          fisler: async () => fisler,
        }),
        oncekiGelenleriGetir(oncekiAylar, {
          getir: (m) => fetchDonemFaturalar("gelen", ayOffset(m)),
          kayitli: kayitliOnceki,
        }),
      ]);
      if (iptal()) return;
      const mesaj = v.qnbHatasi ? (v.qnbHatasi instanceof Error ? v.qnbHatasi.message : String(v.qnbHatasi)) : null;
      setState({
        key,
        loading: false,
        gelen: v.gelenOk ? v.gelen : (kGelen?.data.faturalar ?? []),
        giden: v.gidenOk ? v.giden : (kGiden?.data.faturalar ?? []),
        fisler,
        oncekiGelen: onceki.faturalar,
        error: null,
        qnb: mesaj ? { durum: "hata", at: kayitliAt, mesaj } : null,
      });
      if (force) {
        if (mesaj) toast.warning("e-Faturalar güncellenemedi.");
        else toast.success("KDV verileri güncellendi.");
      }
    } catch (err) {
      if (iptal()) return;
      const msg = err instanceof Error ? err.message : "KDV verileri yüklenemedi.";
      toast.danger(msg);
      setState({ key, loading: false, gelen: [], giden: [], fisler: [], oncekiGelen: [], error: msg, qnb: null });
    }
  }, [activeKey, monthInfo.baslangic, offset]);

  // Dönem verilerini çek: önce fişler + tarayıcıda saklı e-Fatura sonucu (anında), sonra güncel QNB
  useEffect(() => {
    let cancelled = false;
    // Yükleme her zaman eşzamansız başlar (ilk setState bir await'ten sonra gelir)
    void Promise.resolve().then(() => yukleKdv(false, () => cancelled));
    return () => {
      cancelled = true;
    };
  }, [yukleKdv]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const key = activeKey;
      await yukleKdv(true, () => activeKeyRef.current !== key);
    } finally {
      setRefreshing(false);
    }
  };

  // KDV hesaplaması
  const kdv = useMemo<KdvAy | null>(() => {
    if (state.key !== activeKey) return null;
    return kdvAyHesapla(state.gelen, state.giden, state.fisler, undefined, monthInfo.baslangic.slice(0, 7), undefined, state.oncekiGelen);
  }, [state.key, activeKey, state.gelen, state.giden, state.fisler, state.oncekiGelen, monthInfo.baslangic]);

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
          <div className="flex items-center gap-1.5 rounded-lg border bg-surface px-2 py-1 shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm" isIconOnly
              onPress={() => setOffset((o) => o - 1)}
              aria-label="Önceki ay"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-28 text-center text-sm font-semibold">{monthInfo.label}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm" isIconOnly
              isDisabled={offset >= 0}
              onPress={() => setOffset((o) => o + 1)}
              aria-label="Sonraki ay"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onPress={handleRefresh}
            isDisabled={refreshing || loading}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {!loading && state.key === activeKey && state.qnb ? (
        state.qnb.durum === "yukleniyor" ? (
          <Alert status="accent">
            <Alert.Indicator>
              <Spinner size="sm" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>e-Faturalar QNB&apos;den güncelleniyor…</Alert.Title>
              <Alert.Description>
                {state.qnb.at
                  ? `Tutarlar ${saatEtiketi(state.qnb.at)} tarihli kayıtlı e-Fatura bilgileriyle gösteriliyor.`
                  : "İlk yükleme: tutarlar şimdilik yalnızca fişlerden; e-Faturalar gelince eklenir."}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>e-Faturalar güncellenemedi</Alert.Title>
              <Alert.Description>
                {(state.qnb.mesaj ?? "Bilinmeyen hata").replace(/\.+$/, "")}.{" "}
                {state.qnb.at
                  ? `${saatEtiketi(state.qnb.at)} tarihli kayıtlı e-Fatura bilgileri gösteriliyor.`
                  : "KDV şimdilik yalnızca fişlerle hesaplandı; e-Fatura tutarları eksik."}{" "}
                &quot;Yenile&quot; ile tekrar deneyin.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )
      ) : null}

      {/* Ana Net KDV Sonuç Kartı */}
      <Card
        className={
          loading
            ? ""
            : isOdenecek
              ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10"
              : isDevreden
                ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10"
                : "border-default"
        }
      >
        <Card.Header>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted">
              <Calculator className="size-4" />
              {monthInfo.label} KDV Özeti
            </div>
            {!loading && kdv && (
              <Chip size="sm" color={isOdenecek ? "danger" : "default"} variant={isOdenecek || isDevreden ? "soft" : "secondary"}>
                {isOdenecek ? "Tahmini Ödenecek KDV" : isDevreden ? "Sonraki Aya Devreden KDV" : "Sıfır Fark"}
              </Chip>
            )}
          </div>
          <Card.Title className="text-3xl tabular-nums">
            {loading ? (
              <Skeleton className="h-9 w-48" />
            ) : kdv ? (
              `${formatTL(Math.abs(kdv.sonuc))}`
            ) : (
              "—"
            )}
          </Card.Title>
          <Card.Description>
            {loading ? (
              <Skeleton className="h-4 w-72" />
            ) : isOdenecek ? (
              "Kestiğiniz faturalardaki KDV, indirilecek KDV'den fazla olduğu için bu tutarın devlete ödenmesi beklenir."
            ) : isDevreden ? (
              "İndirilecek KDV, hesaplanan KDV'den fazla olduğu için kalan tutar bir sonraki aya devreder."
            ) : (
              "Hesaplanan ve indirilecek KDV tutarları birbirine eşittir."
            )}
          </Card.Description>
        </Card.Header>
      </Card>

      {/* İki Sütunlu Ayrıntı: Kestiğim KDV vs Düşülebilir KDV */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sol Sütun: Kestiğim Faturalar (Hesaplanan KDV) */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <Card.Title>1. Kestiğim Faturalar (Hesaplanan)</Card.Title>
              <TrendingUp className="size-4 text-amber-500" />
            </div>
            <Card.Description>Giden satış faturalarından doğan KDV yükümlülüğü</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-default/20 p-4 text-sm font-sans">
              <div className="flex justify-between">
                <span className="text-muted">Faturada Yazan KDV:</span>
                <span className="font-medium tabular-nums">
                  {loading ? <Skeleton className="h-4 w-20" /> : `${formatTL(kdv?.kestigim.faturada ?? 0)}`}
                </span>
              </div>
              {(kdv?.kestigim.tevkifat ?? 0) > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Tevkifat Kesintisi (Alıcı öder):</span>
                  <span className="tabular-nums">
                    -{formatTL(kdv?.kestigim.tevkifat ?? 0)}
                  </span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Beyan Edilecek KDV:</span>
                <span className="tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-4 w-24" /> : `${formatTL(kdv?.kestigim.beyan ?? 0)}`}
                </span>
              </div>
            </div>

            <div className="text-xs text-muted">
              Toplam <span className="font-semibold text-foreground">{kdv?.kestigim.adet ?? 0}</span> adet giden satış faturası dahil edildi.
            </div>
          </Card.Content>
        </Card>

        {/* Sağ Sütun: Düşülebilir KDV (İndirilecek) */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <Card.Title>2. Düşülebilir KDV (İndirilecek)</Card.Title>
              <TrendingDown className="size-4 text-emerald-500" />
            </div>
            <Card.Description>Alış faturaları ve taranan POS fişlerinden düşülecek KDV</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-default/20 p-4 text-sm font-sans">
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5 text-muted">
                  <FileSpreadsheet className="size-3.5" /> Gelen e-Faturalar ({kdv?.gelenEfatura.adet ?? 0}):
                </span>
                <span className="font-medium tabular-nums">
                  {loading ? <Skeleton className="h-4 w-20" /> : `${formatTL(kdv?.gelenEfatura.kdv ?? 0)}`}
                </span>
              </div>

              {/* Taranan POS Fişleri (Bu ayın fişleri) */}
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5 text-muted">
                  <Receipt className="size-3.5" /> {(kdv?.fis.devredenler?.length ?? 0) > 0 ? `${monthInfo.label.split(" ")[0]} Fişleri` : "Taranan POS Fişleri"} ({kdv?.fis.buAyAdet ?? kdv?.fis.adet ?? 0}):
                </span>
                <span className="font-medium tabular-nums">
                  {loading ? <Skeleton className="h-4 w-20" /> : `${formatTL(kdv?.fis.buAyKdv ?? kdv?.fis.kdv ?? 0)}`}
                </span>
              </div>

              {/* Önceki aylardan devreden KDV kalemleri */}
              {kdv?.fis.devredenler?.map((d) => (
                <div key={d.ay} className="flex justify-between text-muted">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-amber-500" /> {d.etiket} ({d.adet}):
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatTL(d.kdv)}
                  </span>
                </div>
              ))}

              {(kdv?.iade.adet ?? 0) > 0 && (
                <div className="flex justify-between text-danger">
                  <span>Kestiğim İadeler ({kdv?.iade.adet} adet):</span>
                  <span className="tabular-nums">
                    -{formatTL(kdv?.iade.kdv ?? 0)}
                  </span>
                </div>
              )}

              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Toplam Düşülebilir KDV:</span>
                <span className="tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-4 w-24" /> : `${formatTL(kdv?.dusulebilir ?? 0)}`}
                </span>
              </div>
            </div>

            {(kdv?.fis.eslesen ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Info className="size-3.5 text-accent shrink-0" />
                <span>
                  {kdv?.fis.eslesen} adet fiş gelen e-Faturayla mükerrer olmaması için otomatik hariç tutuldu.
                </span>
              </div>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Hesaplama Açıklaması */}
      <Card>
        <Card.Content className="space-y-2 text-xs text-muted">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="size-4 text-accent" />
            KDV Hesabı Nasıl Yapılır?
          </div>
          <p>
            Hesaplanan KDV (Beyan) ile İndirilecek KDV (Gelen faturalar + Fişler − İadeler) arasındaki fark alınır.
            Muhasebeciye bir ay içinde gönderilen fişler bir önceki ayın KDV&apos;sinden düşer (Kasım&apos;da gönderilen → Ekim).
            Henüz gönderilmemiş fişler de bu ay gönderilecekleri varsayılarak bir önceki ayda gösterilir; bu ay tarihli fişler ise kendi ayında kalır.
            Daha eski tarihli fişler devreden KDV kalemi olarak ayrıca listelenir.
          </p>
        </Card.Content>
      </Card>
    </div>
  );
}

function saatEtiketi(at: number): string {
  const d = new Date(at);
  const saat = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return new Date().toDateString() === d.toDateString()
    ? `bugün ${saat}`
    : `${d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} ${saat}`;
}
