"use client";

import { formatTL } from "@shared/lib/format";
import { totalsByCurrency, type Kontrol } from "@shared/services/efatura/qnbEfatura";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  exportExcel,
  exportPdfsZip,
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
  sort,
  onSort,
  align,
  className,
}: {
  label: string;
  column: EFaturaSortColumn;
  sort: EFaturaSortState;
  onSort: (c: EFaturaSortColumn) => void;
  align?: "right";
  className?: string;
}) {
  const active = sort.column === column;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={cn(align === "right" && "text-right", className)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "-mx-2 h-8 px-2 font-medium hover:bg-muted/80 cursor-pointer transition-colors text-muted-foreground",
          align === "right" && "-mr-2 ml-auto",
          active && "text-foreground font-semibold"
        )}
        onClick={() => onSort(column)}
      >
        {label}
        <Icon className={cn("size-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground/60")} />
      </Button>
    </TableHead>
  );
}

export function EFaturaView() {
  const [yon, setYon] = useState<Yon>("gelen");
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
  const activeKey = `${yon}:${offset}`;
  const loading = dataState.key !== activeKey || dataState.loading;
  const faturalar = useMemo(() => {
    return dataState.key === activeKey ? dataState.data.faturalar : [];
  }, [dataState.key, activeKey, dataState.data.faturalar]);
  const kontrol = dataState.key === activeKey ? dataState.data.kontrol : undefined;

  // Dönem verilerini çek
  useEffect(() => {
    let cancelled = false;
    void fetchDonemFaturalar(yon, offset)
      .then((res) => {
        if (!cancelled) {
          setDataState({ key: activeKey, loading: false, data: res });
          if (res.uyari) toast.warning(res.uyari);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Faturalar yüklenemedi.";
          toast.error(msg);
          setDataState({ key: activeKey, loading: false, data: { faturalar: [] } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [yon, offset, activeKey]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetchDonemFaturalar(yon, offset, true);
      setDataState({ key: activeKey, loading: false, data: res });
      toast.success("e-Faturalar güncellendi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleYonChange = (val: Yon) => {
    setYon(val);
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
  const allPageSelected =
    pagedRows.length > 0 && pagedRows.every((r) => selectedIds.has(r.ettn || r.belgeNo));
  const somePageSelected =
    pagedRows.some((r) => selectedIds.has(r.ettn || r.belgeNo)) && !allPageSelected;

  const toggleSelectAll = (checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      for (const r of pagedRows) next.add(r.ettn || r.belgeNo);
    } else {
      for (const r of pagedRows) next.delete(r.ettn || r.belgeNo);
    }
    setSelectedIds(next);
  };

  const toggleSelectRow = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
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
    exportExcel(target, monthInfo.label, yon);
    toast.success("Excel tablosu indirildi.");
  };

  const handleExportZip = async (subset?: EFatura[]) => {
    const target = subset && subset.length > 0 ? subset : faturalar;
    if (target.length === 0) {
      toast.info("Dışa aktarılacak fatura bulunamadı.");
      return;
    }

    setExportingZip(true);
    try {
      const res = await exportPdfsZip(target, monthInfo.label, yon, (done, total) => {
        if (total > 5 && done % 5 === 0) {
          toast.loading(`${done}/${total} PDF indiriliyor…`, { id: "zip-progress" });
        }
      });
      toast.dismiss("zip-progress");
      toast.success(`${res.success} adet PDF arşivi (ZIP) indirildi.`);
    } catch (err) {
      toast.dismiss("zip-progress");
      toast.error(err instanceof Error ? err.message : "Arşiv oluşturulamadı.");
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

        <div className="flex flex-wrap items-center gap-3">
          {/* Yön Değiştirici */}
          <Tabs value={yon} onValueChange={(val) => handleYonChange(val as Yon)}>
            <TabsList>
              <TabsTrigger value="gelen">Gelen e-Faturalar</TabsTrigger>
              <TabsTrigger value="giden">Giden e-Faturalar</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Ay Gezintisi */}
          <div className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleOffsetChange(-1)}
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
              onClick={() => handleOffsetChange(1)}
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

      {/* Özet Kartları */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Toplam Fatura"
          value={loading ? <Skeleton className="h-7 w-20" /> : `${stats.count} adet`}
          description={
            kontrol ? (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Check className="size-3 text-emerald-500" /> QNB: {kontrol.liste} listelendi
              </span>
            ) : undefined
          }
        />
        <StatCard
          title="Toplam Tutar"
          value={loading ? <Skeleton className="h-7 w-32" /> : `${formatTL(stats.tryTotal)} TL`}
          description={
            stats.currencies.length > 0
              ? stats.currencies.map((c) => `${formatTL(c.toplam)} ${c.paraBirimi}`).join(" · ")
              : "KDV Dahil"
          }
        />
        <StatCard
          title="Net KDV Toplamı"
          value={loading ? <Skeleton className="h-7 w-28" /> : `${formatTL(stats.netKdv)} TL`}
          description={yon === "gelen" ? "İndirilecek KDV" : "Hesaplanan Net KDV"}
        />
        <Card size="sm" className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription>Raporlar & Analiz</CardDescription>
            <CardTitle className="text-sm font-medium">Dönem Analizi</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-between text-xs"
              onClick={() => setOzetOpen(true)}
              disabled={loading || faturalar.length === 0}
            >
              <span>Matrah & KDV Özeti</span>
              <FileSpreadsheet className="size-3.5 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar: Arama, Filtre, Sıralama ve Dışa Aktarım Butonları */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Arama */}
          <div className="relative min-w-56 max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Firma adı, belge no, VKN veya tutar…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-8"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSearch("")}
                className="absolute right-1 top-1 size-7"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>

          {/* Tip Filtresi */}
          <Select
            value={tipFilter}
            onValueChange={(val) => {
              setTipFilter(val);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Fatura Tipi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Tipler</SelectItem>
              <SelectItem value="SATIS">Satış</SelectItem>
              <SelectItem value="IADE">İade</SelectItem>
              <SelectItem value="TEVKIFAT">Tevkifat</SelectItem>
              {yon === "giden" && <SelectItem value="earsiv">e-Arşiv</SelectItem>}
              <SelectItem value="iptal_degil">İptal Hariç</SelectItem>
            </SelectContent>
          </Select>

          {/* Sıralama */}
          <Select
            value={`${sort.column}-${sort.dir}`}
            onValueChange={(val) => {
              const preset = SORT_PRESETS.find((p) => p.key === val);
              if (preset) {
                setSort({ column: preset.column, dir: preset.dir });
                setPage(0);
              }
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sıralama" />
            </SelectTrigger>
            <SelectContent>
              {SORT_PRESETS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dönem Dışa Aktarım Butonları */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleExportExcel()}
            disabled={loading || faturalar.length === 0}
            className="gap-1.5"
          >
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleExportZip()}
            disabled={loading || exportingZip || faturalar.length === 0}
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/60 px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {selectedIds.size} fatura seçildi
            </span>
            <span className="text-muted-foreground">
              (Toplam:{" "}
              {formatTL(selectedFaturalar.reduce((acc, f) => acc + f.tutar, 0))} TL)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleExportExcel(selectedFaturalar)}
            >
              <FileSpreadsheet className="size-3.5" />
              Seçilenleri Excel Yap
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={exportingZip}
              onClick={() => handleExportZip(selectedFaturalar)}
            >
              <Download className="size-3.5" />
              Seçilen PDF&apos;leri İndir
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setSelectedIds(new Set())}
            >
              Seçimi Kaldır
            </Button>
          </div>
        </div>
      )}

      {/* e-Fatura Tablosu */}
      <Card>
        <CardContent className="p-0">
          <Table className="min-w-[780px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 pl-4">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                    aria-label="Tümünü seç"
                  />
                </TableHead>
                <SortHeader label="Tarih" column="tarih" sort={sort} onSort={handleSort} className="w-32" />
                <TableHead className="w-44">Belge No</TableHead>
                <SortHeader label="Firma / Ünvan" column="unvan" sort={sort} onSort={handleSort} />
                <SortHeader label="Tür / Tip" column="tip" sort={sort} onSort={handleSort} className="w-32" />
                <SortHeader
                  label="KDV"
                  column="kdv"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                  className="w-32 text-right"
                />
                <SortHeader
                  label="Toplam Tutar"
                  column="tutar"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                  className="w-36 text-right"
                />
                <TableHead className="w-40 pr-4 text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-4">
                      <Skeleton className="size-4" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Skeleton className="ml-auto h-8 w-28" />
                    </TableCell>
                  </TableRow>
                ))}

              {!loading &&
                pagedRows.map((f) => {
                  const id = f.ettn || f.belgeNo;
                  const isSelected = selectedIds.has(id);
                  const isIade = f.tip === "IADE";
                  const isEarsiv = f.tur === "earsiv";

                  return (
                    <TableRow
                      key={id}
                      data-state={isSelected ? "selected" : undefined}
                      className="cursor-pointer transition-colors"
                      onClick={() => setPdfFatura(f)}
                    >
                      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleSelectRow(id, checked === true)}
                          aria-label={`${f.belgeNo} seç`}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">{f.tarih}</TableCell>
                      <TableCell className="font-mono text-xs font-medium">
                        {f.belgeNo || "—"}
                      </TableCell>
                      <TableCell className="max-w-72">
                        <div className="truncate font-medium">{f.unvan}</div>
                        {f.vkn && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            VKN: {f.vkn}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isEarsiv ? (
                            <Badge variant="outline" className="text-[10px]">
                              e-Arşiv
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              e-Fatura
                            </Badge>
                          )}
                          {isIade && (
                            <Badge variant="destructive" className="text-[10px]">
                              İade
                            </Badge>
                          )}
                          {f.iptal && (
                            <Badge variant="destructive" className="text-[10px]">
                              İptal
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {typeof f.kdv === "number" ? `${formatTL(f.kdv)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {isIade ? `-${formatTL(f.tutar)}` : formatTL(f.tutar)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {f.paraBirimi}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-8 gap-1.5 px-2.5 text-xs font-semibold shadow-xs cursor-pointer"
                            title="Faturayı Görüntüle"
                            onClick={() => setPdfFatura(f)}
                          >
                            <FileText className="size-3.5" />
                            <span>Görüntüle</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="cursor-pointer"
                            title="Fatura Kalem Detayları"
                            onClick={() => setDetayFatura(f)}
                          >
                            <Eye className="size-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

              {!loading && filteredFaturalar.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                    {search || tipFilter !== "all"
                      ? "Aramanıza uyan e-fatura bulunamadı."
                      : `${monthInfo.label} döneminde kayıtlı e-fatura yok.`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sayfalama */}
      {!loading && filteredFaturalar.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Toplam {filteredFaturalar.length} faturadan {currentPage * PAGE_SIZE + 1}–
            {Math.min(filteredFaturalar.length, (currentPage + 1) * PAGE_SIZE)} arası gösteriliyor
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="px-2 font-medium">
              Sayfa {currentPage + 1} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
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
        periodLabel={monthInfo.label}
        yon={yon}
        open={ozetOpen}
        onOpenChange={setOzetOpen}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </CardHeader>
    </Card>
  );
}
