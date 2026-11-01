"use client";

import { formatTL } from "@shared/lib/format";
import { totalsByCurrency, type Kontrol } from "@shared/services/efatura/qnbEfatura";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Package,
  Receipt,
  ReceiptText,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Checkbox, Chip, ListBox, SearchField, Select, type Selection, Skeleton, Table, Tabs, toast } from "@heroui/react";
import { PageHeader } from "@/components/layout/page-header";
import {
  exportExcel,
  exportPdfsZip,
  fetchAllFaturalar,
  fetchDonemFaturalar,
  getMonthBounds,
  sortEFaturaList,
  type EFatura,
  type EFaturaSortColumn,
  type EFaturaSortDir,
  type EFaturaSortState,
  type FaturaDetay,
  type Yon,
} from "@/lib/efatura";
import { cn } from "@/lib/utils";
import { DonemOzetDialog } from "./donem-ozet-dialog";
import { FaturaDetayDialog } from "./fatura-detay-dialog";
import { PdfViewerDialog } from "./pdf-viewer-dialog";

const PAGE_SIZE = 50;

const SORT_PRESETS: { key: string; label: string; column: EFaturaSortColumn; dir: EFaturaSortDir }[] = [
  { key: "tarih-desc", label: "Tarih (En Yeni)", column: "tarih", dir: "desc" },
  { key: "tarih-asc", label: "Tarih (En Eski)", column: "tarih", dir: "asc" },
  { key: "unvan-asc", label: "Firma (A–Z)", column: "unvan", dir: "asc" },
  { key: "unvan-desc", label: "Firma (Z–A)", column: "unvan", dir: "desc" },
  { key: "tip-asc", label: "Tür / Tip (A–Z)", column: "tip", dir: "asc" },
  { key: "tip-desc", label: "Tür / Tip (Z–A)", column: "tip", dir: "desc" },
  { key: "kdv-desc", label: "KDV (En Yüksek)", column: "kdv", dir: "desc" },
  { key: "kdv-asc", label: "KDV (En Düşük)", column: "kdv", dir: "asc" },
  { key: "tutar-desc", label: "Tutar (En Yüksek)", column: "tutar", dir: "desc" },
  { key: "tutar-asc", label: "Tutar (En Düşük)", column: "tutar", dir: "asc" },
];

function SortHeader({
  label,
  column,
  align,
  isRowHeader,
  className,
}: {
  label: string;
  column: EFaturaSortColumn;
  align?: "right";
  isRowHeader?: boolean;
  className?: string;
}) {
  return (
    <Table.Column
      id={column}
      allowsSorting
      isRowHeader={isRowHeader}
      className={cn(align === "right" && "text-right", className)}
    >
      {({ sortDirection }) => (
        <Table.SortableColumnHeader
          sortDirection={sortDirection}
          className={cn("text-xs font-semibold", align === "right" && "justify-end")}
        >
          {label}
        </Table.SortableColumnHeader>
      )}
    </Table.Column>
  );
}

export function EFaturaView() {
  const [yon, setYon] = useState<Yon>("gelen");
  const [periodMode, setPeriodMode] = useState<"month" | "all">("month");
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Veri durumu
  const [dataState, setDataState] = useState<{
    key: string;
    loading: boolean;
    data: {
      faturalar: EFatura[];
      uyari?: string;
      bilgi?: string;
      kontrol?: Kontrol;
    };
  }>(() => ({
    key: "initial",
    loading: true,
    data: { faturalar: [] },
  }));

  const [search, setSearch] = useState("");
  const [tipFilter, setTipFilter] = useState<string>("all");
  const [sort, setSort] = useState<EFaturaSortState>({ column: "tarih", dir: "desc" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  // Dialog durumları
  const [pdfFatura, setPdfFatura] = useState<EFatura | null>(null);
  const [detayFatura, setDetayFatura] = useState<EFatura | null>(null);
  const [ozetOpen, setOzetOpen] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);

  const monthInfo = useMemo(() => getMonthBounds(offset), [offset]);
  const displayPeriodLabel = useMemo(() => {
    if (periodMode === "all") {
      return offset === 0 ? "Tüm Zamanlar" : `${monthInfo.label}'a Kadar (Tümü)`;
    }
    return monthInfo.label;
  }, [periodMode, offset, monthInfo.label]);

  const activeKey = `${yon}:${periodMode}:${offset}`;
  const loading = dataState.key !== activeKey || dataState.loading;
  const faturalar = useMemo(() => {
    return dataState.key === activeKey ? dataState.data.faturalar : [];
  }, [dataState.key, activeKey, dataState.data.faturalar]);
  const kontrol = dataState.key === activeKey ? dataState.data.kontrol : undefined;
  // "Tümünü Göster" modunda eksik ay / kapsam notları kalıcı olarak gösterilir
  const tumuUyari = periodMode === "all" && dataState.key === activeKey ? dataState.data.uyari : undefined;
  const tumuBilgi = periodMode === "all" && dataState.key === activeKey ? dataState.data.bilgi : undefined;

  // Dönem veya tüm verileri çek
  useEffect(() => {
    let cancelled = false;
    const fetcher =
      periodMode === "all"
        ? fetchAllFaturalar(yon, offset)
        : fetchDonemFaturalar(yon, offset);

    void fetcher
      .then((res) => {
        if (!cancelled) {
          setDataState({ key: activeKey, loading: false, data: res });
          if (res.uyari) toast.warning(res.uyari);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Faturalar yüklenemedi.";
          toast.danger(msg);
          setDataState({ key: activeKey, loading: false, data: { faturalar: [] } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [yon, periodMode, offset, activeKey]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res =
        periodMode === "all"
          ? await fetchAllFaturalar(yon, offset, true)
          : await fetchDonemFaturalar(yon, offset, true);
      setDataState({ key: activeKey, loading: false, data: res });
      if (res.uyari) toast.warning(res.uyari);
      else toast.success("e-Faturalar güncellendi.");
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Güncellenemedi.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleYonChange = (val: Yon) => {
    setYon(val);
    setSelectedIds(new Set());
    setPage(0);
  };

  const handlePeriodModeChange = (mode: "month" | "all") => {
    setPeriodMode(mode);
    setSelectedIds(new Set());
    setPage(0);
  };

  const handleOffsetChange = (delta: number) => {
    setOffset((o) => o + delta);
    setSelectedIds(new Set());
    setPage(0);
  };

  const handleSort = (column: EFaturaSortColumn) => {
    setSort((prev) => {
      if (prev.column === column) {
        return { column, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      const defaultDir: EFaturaSortDir = column === "unvan" || column === "tip" ? "asc" : "desc";
      return { column, dir: defaultDir };
    });
    setPage(0);
  };

  const handleDetayLoaded = useCallback((ettn: string, detay: FaturaDetay) => {
    setDataState((prev) => {
      let changed = false;
      const updated = prev.data.faturalar.map((f) => {
        if (f.ettn.toLowerCase() === ettn.toLowerCase() && typeof f.kdv !== "number") {
          changed = true;
          return {
            ...f,
            kdv: typeof detay.kdvToplam === "number" ? detay.kdvToplam : f.kdv,
            matrah: typeof detay.araToplam === "number" ? detay.araToplam : f.matrah,
          };
        }
        return f;
      });
      if (!changed) return prev;
      return { ...prev, data: { ...prev.data, faturalar: updated } };
    });
  }, []);

  // Filtreleme ve Arama
  const filteredFaturalar = useMemo(() => {
    let list = faturalar;

    if (tipFilter !== "all") {
      if (tipFilter === "IADE") list = list.filter((f) => f.tip === "IADE");
      else if (tipFilter === "SATIS") list = list.filter((f) => f.tip === "SATIS");
      else if (tipFilter === "TEVKIFAT") list = list.filter((f) => f.tip === "TEVKIFAT");
      else if (tipFilter === "earsiv") list = list.filter((f) => f.tur === "earsiv");
      else if (tipFilter === "iptal_degil") list = list.filter((f) => !f.iptal);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.unvan.toLowerCase().includes(q) ||
          f.belgeNo.toLowerCase().includes(q) ||
          f.vkn.includes(q) ||
          f.ettn.toLowerCase().includes(q) ||
          String(f.tutar).includes(q),
      );
    }

    return sortEFaturaList(list, sort);
  }, [faturalar, tipFilter, search, sort]);

  // Sayfalama
  const pageCount = Math.max(1, Math.ceil(filteredFaturalar.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedRows = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredFaturalar.slice(start, start + PAGE_SIZE);
  }, [filteredFaturalar, currentPage]);

  // Seçim işlemleri
  // Tablo seçimi sayfa bazlıdır; diğer sayfalardaki seçimler korunur.
  const onTableSelection = (keys: Selection) => {
    const pageIds = pagedRows.map((r) => r.ettn || r.belgeNo);
    if (keys === "all") {
      setSelectedIds(new Set([...selectedIds, ...pageIds]));
    } else if (keys.size === 0) {
      const next = new Set(selectedIds);
      for (const id of pageIds) next.delete(id);
      setSelectedIds(next);
    } else {
      setSelectedIds(new Set([...keys].map(String)));
    }
  };

  const selectedFaturalar = useMemo(() => {
    return faturalar.filter((f) => selectedIds.has(f.ettn || f.belgeNo));
  }, [faturalar, selectedIds]);

  // Toplam Tutar ve KDV hesaplamaları
  const stats = useMemo(() => {
    const gecerli = faturalar.filter((f) => !f.iptal && !f.taslak);
    const tryList = gecerli.filter((f) => f.paraBirimi === "TRY");
    const tryTotal = tryList.reduce((acc, f) => acc + f.tutar, 0);

    // KDV toplamı (Satış KDV - İade KDV)
    const iadelerKdv = tryList
      .filter((f) => f.tip === "IADE" && typeof f.kdv === "number")
      .reduce((acc, f) => acc + (f.kdv ?? 0), 0);
    const digerKdv = tryList
      .filter((f) => f.tip !== "IADE" && typeof f.kdv === "number")
      .reduce((acc, f) => acc + (f.kdv ?? 0), 0);
    const netKdv = Math.round((digerKdv - iadelerKdv) * 100) / 100;

    const currencies = totalsByCurrency(faturalar).filter((c) => c.paraBirimi !== "TRY");

    return {
      count: faturalar.length,
      tryTotal,
      netKdv,
      currencies,
    };
  }, [faturalar]);

  // Dışa Aktarım Eylemleri
  const handleExportExcel = (subset?: EFatura[]) => {
    const target = subset && subset.length > 0 ? subset : faturalar;
    if (target.length === 0) {
      toast.info("Dışa aktarılacak fatura bulunamadı.");
      return;
    }
    exportExcel(target, displayPeriodLabel, yon);
    toast.success("Excel tablosu indirildi.");
  };

  const handleExportZip = async (subset?: EFatura[]) => {
    const target = subset && subset.length > 0 ? subset : faturalar;
    if (target.length === 0) {
      toast.info("Dışa aktarılacak fatura bulunamadı.");
      return;
    }

    setExportingZip(true);
    let progressId: string | null = null;
    try {
      const res = await exportPdfsZip(target, displayPeriodLabel, yon, (done, total) => {
        if (total > 5 && done % 5 === 0) {
          const msg = `${done}/${total} PDF indiriliyor…`;
          if (progressId) toast.update(progressId, msg, { isLoading: true, timeout: 0 });
          else progressId = toast(msg, { isLoading: true, timeout: 0 });
        }
      });
      if (progressId) toast.close(progressId);
      toast.success(`${res.success} adet PDF arşivi (ZIP) indirildi.`);
    } catch (err) {
      if (progressId) toast.close(progressId);
      toast.danger(err instanceof Error ? err.message : "Arşiv oluşturulamadı.");
    } finally {
      setExportingZip(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Üst Başlık & Dönem ve Yön Seçici */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="e-Faturalar"
          description={`${yon === "gelen" ? "Gelen" : "Giden"} faturalarınızı inceleyin, PDF'lerini görüntüleyin ve dışa aktarın.`}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Yön Değiştirici (Gelen / Giden) */}
          <Tabs className="w-fit shrink-0" selectedKey={yon} onSelectionChange={(key) => handleYonChange(key as Yon)}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Fatura yönü">
                <Tabs.Tab id="gelen" className="whitespace-nowrap">
                  Gelen e-Faturalar
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="giden" className="whitespace-nowrap">
                  Giden e-Faturalar
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          {/* Dönem modu (Tümünü Göster / Aylık) */}
          <Tabs className="w-fit shrink-0"
            selectedKey={periodMode}
            onSelectionChange={(key) => handlePeriodModeChange(key as "month" | "all")}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Dönem modu">
                <Tabs.Tab id="all" className="whitespace-nowrap">
                  Tümünü Göster
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="month" className="whitespace-nowrap">
                  Aylık
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          {/* Dönem Seçici ve İleri / Geri Butonları */}
          <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/80 px-1.5 h-9 shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm" isIconOnly
             
              onPress={() => handleOffsetChange(-1)}
              aria-label="Önceki dönem"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-28 text-center text-xs font-semibold px-2">
              {displayPeriodLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm" isIconOnly
             
              isDisabled={offset >= 0}
              onPress={() => handleOffsetChange(1)}
              aria-label="Sonraki dönem"
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

      {/* Apple Native Glass Metrik Kartları (Tahoe Glass) */}
      {!loading && (tumuUyari || tumuBilgi) ? (
        <Card className="space-y-1.5 text-xs">
          {tumuUyari ? (
            <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
              <TriangleAlert className="size-3.5 mt-px shrink-0" />
              <span>{tumuUyari}</span>
            </div>
          ) : null}
          {tumuBilgi ? (
            <div className="flex items-start gap-2 text-muted">
              <Info className="size-3.5 mt-px shrink-0" />
              <span>{tumuBilgi}</span>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Kart 1: Toplam Belge */}
        <Card className="relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center shadow-sm shadow-sky-500/25">
              <FileText className="size-4.5 stroke-[2]" />
            </div>
            <Chip size="sm" variant="soft" color="accent" className="tabular-nums">
              {stats.count} Belge
            </Chip>
          </div>
          <div className="text-xs font-medium text-muted">
            {yon === "gelen" ? "Gelen Faturalar" : "Giden Faturalar"}
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-0.5">
            {loading ? <Skeleton className="h-7 w-20 my-0.5" /> : `${stats.count} Adet`}
          </div>
          <div className="text-[11px] text-muted mt-1 flex items-center gap-1.5 truncate">
            {kontrol ? (
              <>
                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>QNB: {kontrol.liste} listelendi</span>
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-sky-500 shrink-0" />
                <span>{displayPeriodLabel} kayıtları</span>
              </>
            )}
          </div>
        </Card>

        {/* Kart 2: Toplam Tutar */}
        <Card className="relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-sm shadow-emerald-500/25">
              <Receipt className="size-4.5 stroke-[2]" />
            </div>
            <Chip size="sm" variant="soft" color="success">
              KDV Dahil
            </Chip>
          </div>
          <div className="text-xs font-medium text-muted">
            {yon === "gelen" ? "Toplam Gider Tutarı" : "Toplam Satış Tutarı"}
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-0.5">
            {loading ? <Skeleton className="h-7 w-32 my-0.5" /> : `${formatTL(stats.tryTotal)}`}
          </div>
          <div className="text-[11px] text-muted mt-1 flex items-center gap-1.5 truncate">
            {stats.currencies.length > 0 ? (
              <span className="tabular-nums truncate">
                {stats.currencies.map((c) => `${formatTL(c.toplam)} ${c.paraBirimi}`).join(" · ")}
              </span>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>TRY cinsinden fatura yekûnu</span>
              </>
            )}
          </div>
        </Card>

        {/* Kart 3: Net KDV Toplamı */}
        <Card className="relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-sm shadow-indigo-500/25">
              <ReceiptText className="size-4.5 stroke-[2]" />
            </div>
            <Chip size="sm" variant="soft" color="accent">
              {yon === "gelen" ? "İndirilecek KDV" : "Hesaplanan KDV"}
            </Chip>
          </div>
          <div className="text-xs font-medium text-muted">
            {yon === "gelen" ? "Düşülebilir Toplam KDV" : "Tahakkuk Eden KDV"}
          </div>
          <div className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums mt-0.5">
            {loading ? <Skeleton className="h-7 w-28 my-0.5" /> : `${formatTL(stats.netKdv)}`}
          </div>
          <div className="text-[11px] text-muted mt-1 flex items-center gap-1.5 truncate">
            <span className="size-1.5 rounded-full bg-indigo-500 shrink-0" />
            <span>{yon === "gelen" ? "Beyannameden düşülebilir vergi" : "Satışlardan doğan KDV yükümlülüğü"}</span>
          </div>
        </Card>

        {/* Kart 4: Raporlar & Dönem Analizi */}
        <Card className="relative overflow-hidden group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="size-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-sm shadow-amber-500/25">
                <BarChart3 className="size-4.5 stroke-[2]" />
              </div>
              <Chip size="sm" variant="soft" color="warning">
                Rapor & Döküm
              </Chip>
            </div>
            <div className="text-xs font-medium text-muted">Matrah & KDV Dökümü</div>
            <div className="text-base font-bold tracking-tight text-foreground mt-0.5">
              Dönem Analizi
            </div>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-between"
              onPress={() => setOzetOpen(true)}
              isDisabled={loading || faturalar.length === 0}
            >
              <span>Matrah & KDV Özeti</span>
              <FileSpreadsheet className="size-3.5 shrink-0" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Toolbar: Arama, Filtre, Sıralama ve Dışa Aktarım Butonları */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Arama */}
          <SearchField
            aria-label="e-Faturalarda ara"
            className="min-w-56 max-w-sm flex-1"
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Firma adı, belge no, VKN veya tutar…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          {/* Tip Filtresi */}
          <Select className="w-40" placeholder="Fatura Tipi" aria-label="Fatura Tipi"
            value={tipFilter}
            onChange={(key) => {
              const val = String(key);
              setTipFilter(val);
              setPage(0);
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="all">
                  Tüm Tipler
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="SATIS">
                  Satış
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="IADE">
                  İade
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="TEVKIFAT">
                  Tevkifat
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {yon === "giden" && <ListBox.Item id="earsiv">e-Arşiv
                <ListBox.ItemIndicator />
              </ListBox.Item>}
                <ListBox.Item id="iptal_degil">
                  İptal Hariç
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
          </Select.Popover>
          </Select>

          {/* Sıralama */}
          <Select className="w-48" placeholder="Sıralama" aria-label="Sıralama"
            value={`${sort.column}-${sort.dir}`}
            onChange={(key) => {
              const val = String(key);
              const preset = SORT_PRESETS.find((p) => p.key === val);
              if (preset) {
                setSort({ column: preset.column, dir: preset.dir });
                setPage(0);
              }
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {SORT_PRESETS.map((s) => (
                  <ListBox.Item key={s.key} id={s.key}>
                    {s.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
          </Select.Popover>
          </Select>
        </div>

        {/* Dönem Dışa Aktarım Butonları */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPress={() => handleExportExcel()}
            isDisabled={loading || faturalar.length === 0}
            className="gap-1.5"
          >
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onPress={() => handleExportZip()}
            isDisabled={loading || exportingZip || faturalar.length === 0}
            className="gap-1.5"
          >
            {exportingZip ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Package className="size-4" />
            )}
            PDF Paketi (ZIP)
          </Button>
        </div>
      </div>

      {/* Toplu İşlem Seçim Çubuğu */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-default/60 px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {selectedIds.size} fatura seçildi
            </span>
            <span className="text-muted">
              (Toplam:{" "}
              {formatTL(selectedFaturalar.reduce((acc, f) => acc + f.tutar, 0))})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onPress={() => handleExportExcel(selectedFaturalar)}
            >
              <FileSpreadsheet className="size-3.5" />
              Seçilenleri Excel Yap
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              isDisabled={exportingZip}
              onPress={() => handleExportZip(selectedFaturalar)}
            >
              <Download className="size-3.5" />
              Seçilen PDF&apos;leri İndir
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onPress={() => setSelectedIds(new Set())}
            >
              Seçimi Kaldır
            </Button>
          </div>
        </div>
      )}

      {/* Apple Glass e-Fatura Tablosu */}
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="e-Faturalar" className="min-w-[780px]"
            selectionMode="multiple"
              selectedKeys={selectedIds}
              onSelectionChange={onTableSelection}
              disabledKeys={loading ? Array.from({ length: 6 }, (_, i) => `iskelet-${i}`) : ["bos"]}
              sortDescriptor={{ column: sort.column, direction: sort.dir === "asc" ? "ascending" : "descending" }}
            onSortChange={(d) => handleSort(d.column as EFaturaSortColumn)}
          >
            <Table.Header>
              <Table.Column className="w-12">
                <Checkbox
                  slot="selection"
                  variant="secondary"
                  aria-label="Tümünü seç"
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>
              </Table.Column>
              <SortHeader label="Tarih" column="tarih" className="w-32" />
              <Table.Column className="w-44">Belge No</Table.Column>
              <SortHeader label="Firma / Ünvan" column="unvan" isRowHeader />
              <SortHeader label="Tür / Tip" column="tip" className="w-32" />
              <SortHeader
                label="KDV"
                column="kdv"
                align="right"
                className="w-32 text-right"
              />
              <SortHeader
                label="Toplam Tutar"
                column="tutar"
                align="right"
                className="w-36 text-right"
              />
              <Table.Column className="w-40 text-right">İşlemler</Table.Column>
            </Table.Header>

            <Table.Body>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <Table.Row key={i} id={`iskelet-${i}`}>
                    <Table.Cell>
                      <Skeleton className="size-4" />
                    </Table.Cell>
                    <Table.Cell>
                      <Skeleton className="h-4 w-20" />
                    </Table.Cell>
                    <Table.Cell>
                      <Skeleton className="h-4 w-28" />
                    </Table.Cell>
                    <Table.Cell>
                      <Skeleton className="h-4 w-48" />
                    </Table.Cell>
                    <Table.Cell>
                      <Skeleton className="h-4 w-16" />
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Skeleton className="ml-auto h-8 w-28" />
                    </Table.Cell>
                  </Table.Row>
                ))}

              {!loading &&
                pagedRows.map((f) => {
                  const id = f.ettn || f.belgeNo;
                  const isIade = f.tip === "IADE";
                  const isEarsiv = f.tur === "earsiv";

                  return (
                    <Table.Row
                      key={id}
                      id={id}
                      onAction={() => setPdfFatura(f)}
                    >
                      <Table.Cell>
                        <Checkbox
                          slot="selection"
                          variant="secondary"
                          aria-label={`${f.belgeNo} seç`}
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                      </Table.Cell>
                      <Table.Cell className="tabular-nums text-xs">{f.tarih}</Table.Cell>
                      <Table.Cell className="tabular-nums text-xs font-medium">
                        {f.belgeNo || "—"}
                      </Table.Cell>
                      <Table.Cell className="max-w-72">
                        <div className="truncate font-medium">{f.unvan}</div>
                        {f.vkn && (
                          <div className="text-[11px] text-muted tabular-nums">
                            VKN: {f.vkn}
                          </div>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-wrap gap-1">
                          {isEarsiv ? (
                            <Chip size="sm" variant="secondary">
                              e-Arşiv
                            </Chip>
                          ) : (
                            <Chip size="sm" variant="soft">
                              e-Fatura
                            </Chip>
                          )}
                          {isIade && (
                            <Chip size="sm" color="danger" variant="soft">
                              İade
                            </Chip>
                          )}
                          {f.iptal && (
                            <Chip size="sm" color="danger" variant="soft">
                              İptal
                            </Chip>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-right text-xs tabular-nums text-muted">
                        {typeof f.kdv === "number" ? `${formatTL(f.kdv)}` : "—"}
                      </Table.Cell>
                      <Table.Cell className="text-right text-sm font-semibold tabular-nums">
                        {isIade ? `-${formatTL(f.tutar)}` : formatTL(f.tutar)}{" "}
                        <span className="text-xs font-normal text-muted">
                          {f.paraBirimi}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="gap-1.5"
                            aria-label="Faturayı Görüntüle"
                            onPress={() => setPdfFatura(f)}
                          >
                            <FileText className="size-3.5" />
                            <span>Görüntüle</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm" isIconOnly
                            aria-label="Fatura Kalem Detayları"
                            onPress={() => setDetayFatura(f)}
                          >
                            <Eye className="size-4 text-muted hover:text-foreground" />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}

              {!loading && filteredFaturalar.length === 0 && (
                <Table.Row id="bos">
                  <Table.Cell colSpan={8} className="text-center text-sm text-muted">
                    {search || tipFilter !== "all"
                      ? "Aramanıza uyan e-fatura bulunamadı."
                      : `${displayPeriodLabel} döneminde kayıtlı e-fatura yok.`}
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {/* Sayfalama */}
      {!loading && filteredFaturalar.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Toplam {filteredFaturalar.length} faturadan {currentPage * PAGE_SIZE + 1}–
            {Math.min(filteredFaturalar.length, (currentPage + 1) * PAGE_SIZE)} arası gösteriliyor
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm" isIconOnly
              isDisabled={currentPage === 0}
              onPress={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="px-2 font-medium">
              Sayfa {currentPage + 1} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm" isIconOnly
              isDisabled={currentPage >= pageCount - 1}
              onPress={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* PDF Görüntüleyici Dialog */}
      <PdfViewerDialog
        fatura={pdfFatura}
        yon={yon}
        open={Boolean(pdfFatura)}
        onOpenChange={(open) => !open && setPdfFatura(null)}
      />

      {/* Fatura Kalem Detayı Dialog */}
      <FaturaDetayDialog
        fatura={detayFatura}
        yon={yon}
        open={Boolean(detayFatura)}
        onOpenChange={(open) => !open && setDetayFatura(null)}
        onOpenPdf={(f) => {
          setDetayFatura(null);
          setPdfFatura(f);
        }}
        onDetayLoaded={handleDetayLoaded}
      />

      {/* Dönem KDV & Matrah Özeti Dialog */}
      <DonemOzetDialog
        faturalar={faturalar}
        periodLabel={displayPeriodLabel}
        yon={yon}
        open={ozetOpen}
        onOpenChange={setOzetOpen}
      />
    </div>
  );
}


