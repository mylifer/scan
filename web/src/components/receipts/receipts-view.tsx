"use client";

import { allCategories, categoryLabel } from "@shared/lib/categories";
import { formatTL, isoToTrDate } from "@shared/lib/format";
import { periodRange, stepPeriod, switchMode, type Period } from "@shared/lib/period";
import { receiptMatcher } from "@shared/lib/search";
import { isSent, summarizeReceipts } from "@shared/lib/summary";
import type { ReceiptRecord } from "@shared/types/receipt";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileSpreadsheet,
  Filter,
  Image as ImageIcon,
  Package,
  Plus,
  Receipt,
  ReceiptText,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteReceipt, listReceipts, loadCustomCategories, markReceiptsSent } from "@/lib/receipts";
import { exportExcel, exportPackage } from "@/lib/receiptExport";
import { sortRows, type SortColumn, type SortState } from "@/lib/receiptTable";
import { CategoryBadge, getCategoryVisuals } from "@/components/ui/category-badge";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type Loaded = { key: string; rows: ReceiptRecord[]; error?: string };

export function ReceiptsView() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>({ mode: "all" });
  const [reloadTick, setReloadTick] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [categories, setCategories] = useState<readonly string[]>(() => allCategories());
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState>({ column: "tarih", dir: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const range = useMemo(() => periodRange(period), [period]);
  const periodKey = period.mode === "all" ? "all" : `${period.mode[0]}${period.offset}`;
  const loadKey = `${periodKey}:${reloadTick}`;
  const loading = loaded?.key !== loadKey;

  useEffect(() => {
    let active = true;
    listReceipts(range ? { from: range.from, to: range.to } : undefined).then(
      (rows) => active && setLoaded({ key: loadKey, rows }),
      (e: unknown) => active && setLoaded({ key: loadKey, rows: [], error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      active = false;
    };
  }, [loadKey, range]);

  useEffect(() => {
    loadCustomCategories().then(() => setCategories(allCategories()));
  }, []);

  const rows = useMemo(() => (loading ? [] : (loaded?.rows ?? [])), [loading, loaded]);
  const filtered = useMemo(() => {
    const match = receiptMatcher(query);
    return sortRows(
      rows.filter((r) => match(r) && (catFilter.size === 0 || catFilter.has(r.kategori))),
      sort,
    );
  }, [rows, query, catFilter, sort]);
  const summary = useMemo(() => summarizeReceipts(filtered), [filtered]);
  const sentCount = useMemo(() => filtered.filter(isSent).length, [filtered]);
  const pendingCount = Math.max(0, summary.fisSayisi - sentCount);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const selectedRows = filtered.filter((r) => selected.has(r.id));
  const allSelected = filtered.length > 0 && selectedRows.length === filtered.length;
  const someSelected = selectedRows.length > 0 && !allSelected;

  function resetView() {
    setSelected(new Set());
    setPage(0);
  }

  function toggleSort(column: SortColumn) {
    setSort((s) => (s.column === column ? { column, dir: s.dir === "asc" ? "desc" : "asc" } : { column, dir: column === "firma_adi" || column === "kategori" ? "asc" : "desc" }));
  }

  function toggleRow(id: string, on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const exportRows = selectedRows.length ? selectedRows : filtered;
  const exportLabel = range?.label ?? "Tüm zamanlar";

  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const onExcel = () =>
    run("excel", async () => {
      exportExcel(exportRows, exportLabel, range?.fileTag);
      toast.success(`${exportRows.length} fiş Excel'e aktarıldı`);
    });

  const onPackage = () =>
    run("zip", async () => {
      const id = toast.loading("Paket hazırlanıyor…");
      const res = await exportPackage(exportRows, exportLabel, range?.fileTag, (d, t) =>
        toast.loading(`Fotoğraflar indiriliyor… ${d}/${t}`, { id }),
      );
      toast.success(`Paket hazır: ${res.photos} fotoğraf${res.failed ? `, ${res.failed} indirilemedi` : ""}`, { id });
    });

  const onMarkSent = (sent: boolean) =>
    run("sent", async () => {
      const n = await markReceiptsSent(selectedRows.map((r) => r.id), sent);
      toast.success(sent ? `${n} fiş gönderildi olarak işaretlendi` : `${n} fişin işareti kaldırıldı`);
      resetView();
      setReloadTick((t) => t + 1);
    });

  const onDelete = () =>
    run("delete", async () => {
      let trash = 0;
      for (const r of selectedRows) if ((await deleteReceipt(r.id)) === "trash") trash++;
      toast.success(trash ? `${selectedRows.length} fiş Son Silinenler'e taşındı` : `${selectedRows.length} fiş silindi`);
      setConfirmDelete(false);
      resetView();
      setReloadTick((t) => t + 1);
    });

  return (
    <div className="flex flex-col gap-5">
      {/* Apple Native Glass Üst Başlık & Aksiyon */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Fişler</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/15">
              {exportLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Taranan harcama ve POS fişlerinin konsolide dökümü, vergi ve muhasebe takibi
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            asChild
            className="rounded-full bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_2px_14px_rgba(14,165,233,0.3)] border border-white/20 active:scale-95 transition-all font-semibold px-4 h-9 gap-1.5"
          >
            <Link href="/fisler/yeni/">
              <Plus className="size-4 stroke-[2.5]" />
              <span>Yeni Fiş</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Apple Native Glass Metrik Kartları (Tahoe Glass) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Kart 1: Toplam Harcama */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl p-4.5 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center shadow-sm shadow-sky-500/25">
              <CreditCard className="size-4.5 stroke-[2]" />
            </div>
            <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/15">
              {summary.fisSayisi} Fiş
            </span>
          </div>
          <div className="text-xs font-medium text-muted-foreground">Toplam Harcama</div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-0.5">
            {loading ? <Skeleton className="h-7 w-28 my-0.5" /> : `${formatTL(summary.toplamGider)} TL`}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-sky-500"></span>
            <span>Kayıtlı brüt gider toplamı</span>
          </div>
        </div>

        {/* Kart 2: İndirilebilir KDV */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl p-4.5 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-sm shadow-emerald-500/25">
              <ReceiptText className="size-4.5 stroke-[2]" />
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15">
              KDV İndirimi
            </span>
          </div>
          <div className="text-xs font-medium text-muted-foreground">Düşülebilir Toplam KDV</div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
            {loading ? <Skeleton className="h-7 w-28 my-0.5" /> : `${formatTL(summary.toplamKdv)} TL`}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 tabular-nums truncate">
            %1: {formatTL(summary.kdv1)} · %10: {formatTL(summary.kdv10)} · %20: {formatTL(summary.kdv20)}
          </div>
        </div>

        {/* Kart 3: Muhasebeye Teslim Oranı */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl p-4.5 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-sm shadow-indigo-500/25">
              <CheckCircle2 className="size-4.5 stroke-[2]" />
            </div>
            <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15">
              %{summary.fisSayisi > 0 ? Math.round((sentCount / summary.fisSayisi) * 100) : 0} Oran
            </span>
          </div>
          <div className="text-xs font-medium text-muted-foreground">Muhasebeye Teslim Edilen</div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-0.5">
            {loading ? <Skeleton className="h-7 w-24 my-0.5" /> : `${sentCount} / ${summary.fisSayisi}`}
          </div>
          <div className="w-full bg-muted/80 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${summary.fisSayisi > 0 ? (sentCount / summary.fisSayisi) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Kart 4: İşlem Bekleyen Fişler */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl p-4.5 shadow-[0_2px_16px_rgba(0,0,0,0.03)] hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-sm shadow-amber-500/25">
              <Clock className="size-4.5 stroke-[2]" />
            </div>
            {pendingCount > 0 ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15">
                İşlem Bekliyor
              </span>
            ) : (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15">
                Eksik Yok
              </span>
            )}
          </div>
          <div className="text-xs font-medium text-muted-foreground">Teslim Bekleyen Fişler</div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-0.5">
            {loading ? <Skeleton className="h-7 w-20 my-0.5" /> : `${pendingCount} Fiş`}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {pendingCount > 0 ? "Sonraki aya devredebilir" : "Tüm fişler muhasebeleştirildi"}
          </div>
        </div>
      </div>

      {/* Apple Spotlight Arama, Segmented Switch & Filtre Araç Çubuğu */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-card/60 backdrop-blur-xl border border-border/70 p-2 shadow-xs">
        {/* Spotlight Tarzı Arama Alanı */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetView();
            }}
            placeholder="Firma, not, etiket, tutar ara…"
            className="pl-9 h-9 rounded-xl bg-background/80 border-border/60 focus:bg-background text-xs"
            aria-label="Fişlerde ara"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                resetView();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Apple Segmented Period Switcher */}
        <div className="p-0.5 bg-muted/80 backdrop-blur-md rounded-xl border border-border/50 flex items-center">
          <Tabs
            value={period.mode}
            onValueChange={(v) => {
              setPeriod((p) => switchMode(p, v as Period["mode"]));
              resetView();
            }}
          >
            <TabsList className="h-8 bg-transparent p-0 gap-0.5">
              <TabsTrigger
                value="all"
                className="h-7 px-3 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
              >
                Tüm Zamanlar
              </TabsTrigger>
              <TabsTrigger
                value="month"
                className="h-7 px-3 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
              >
                Aylık
              </TabsTrigger>
              <TabsTrigger
                value="year"
                className="h-7 px-3 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
              >
                Yıllık
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* İleri/Geri Butonları (Aylık/Yıllık seçildiğinde belirir) */}
        {period.mode !== "all" && (
          <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/80 px-1.5 h-8 shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-6 rounded-lg"
              onClick={() => {
                setPeriod((p) => stepPeriod(p, -1));
                resetView();
              }}
              aria-label={period.mode === "month" ? "Önceki ay" : "Önceki yıl"}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="min-w-24 text-center text-xs font-semibold capitalize px-1">
              {range?.label}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-6 rounded-lg"
              disabled={period.offset >= 0}
              onClick={() => {
                setPeriod((p) => stepPeriod(p, 1));
                resetView();
              }}
              aria-label={period.mode === "month" ? "Sonraki ay" : "Sonraki yıl"}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Kategori Filtresi */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 rounded-xl border-border/70 bg-background/80 text-xs gap-1.5 transition-colors",
                catFilter.size > 0 && "border-primary/50 text-foreground bg-accent/40 font-semibold",
              )}
            >
              <Filter className="size-3.5" /> Kategori
              {catFilter.size > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-md tabular-nums font-bold">
                  {catFilter.size}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto rounded-2xl p-1.5">
            <DropdownMenuLabel className="text-xs font-semibold">Kategoriye Göre Filtrele</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {categories.map((k) => {
              const v = getCategoryVisuals(k);
              return (
                <DropdownMenuCheckboxItem
                  key={k}
                  checked={catFilter.has(k)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(on) => {
                    setCatFilter((s) => {
                      const next = new Set(s);
                      if (on) next.add(k);
                      else next.delete(k);
                      return next;
                    });
                    resetView();
                  }}
                  className="text-xs cursor-pointer py-1.5 rounded-lg flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm shrink-0">{v.icon}</span>
                    <span>{categoryLabel(k)}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              );
            })}
            {catFilter.size > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setCatFilter(new Set());
                    resetView();
                  }}
                  className="text-xs text-destructive cursor-pointer rounded-lg"
                >
                  <X className="size-3.5" /> Filtreyi temizle
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dışa Aktarım Düğmeleri */}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onExcel}
            disabled={!exportRows.length || !!busy}
            className="h-8 rounded-xl border-border/70 bg-background/80 text-xs gap-1.5"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onPackage}
            disabled={!exportRows.length || !!busy}
            className="h-8 rounded-xl border-border/70 bg-background/80 text-xs gap-1.5"
          >
            <Package className="size-3.5 text-sky-600 dark:text-sky-400" /> Paket (ZIP)
          </Button>
        </div>
      </div>

      {/* Aktif Kategori Filtresi Chipleri (Option 04 Dual-Tone Segmented) */}
      {catFilter.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card/50 border border-border/70 px-3.5 py-2 text-xs shadow-2xs animate-in fade-in-50 duration-150">
          <span className="text-[11px] text-muted-foreground font-semibold">Filtrelenen Kategoriler:</span>
          {Array.from(catFilter).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setCatFilter((s) => {
                  const next = new Set(s);
                  next.delete(k);
                  return next;
                });
                resetView();
              }}
              className="group inline-flex items-center gap-1 hover:opacity-85 transition-opacity cursor-pointer"
              title={`${categoryLabel(k)} filtresini kaldır`}
            >
              <CategoryBadge category={k} size="sm" />
              <span className="size-4 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                <X className="size-2.5" />
              </span>
            </button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCatFilter(new Set());
              resetView();
            }}
            className="h-6 text-[11px] text-muted-foreground hover:text-destructive px-2 ml-auto"
          >
            Tümünü Kaldır
          </Button>
        </div>
      )}

      {/* Çoklu Seçim Eylem Şeridi */}
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/5 backdrop-blur-md px-4 py-2.5 text-sm shadow-xs animate-in fade-in-50 duration-150">
          <span className="font-semibold text-foreground">{selectedRows.length} fiş seçildi</span>
          <span className="text-muted-foreground tabular-nums">· {formatTL(summarizeReceipts(selectedRows).toplamGider)} TL</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs gap-1.5" onClick={() => onMarkSent(true)} disabled={!!busy}>
              <Send className="size-3.5" /> Gönderildi işaretle
            </Button>
            <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs gap-1.5" onClick={() => onMarkSent(false)} disabled={!!busy}>
              <X className="size-3.5" /> İşareti kaldır
            </Button>
            <Button size="sm" variant="destructive" className="h-8 rounded-xl text-xs gap-1.5" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
              <Trash2 className="size-3.5" /> Sil
            </Button>
            <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs" onClick={() => setSelected(new Set())}>
              Seçimi temizle
            </Button>
          </div>
        </div>
      )}

      {/* Apple Glass Fiş Tablosu */}
      <Card className="py-0 rounded-2xl overflow-hidden border-border/80 dark:border-white/[0.08] bg-card/75 backdrop-blur-xl shadow-xs">
        <CardContent className="px-0">
          <Table className="min-w-[700px]">
            <TableHeader className="bg-muted/30">
              <TableRow className="border-b border-border/60 dark:border-white/[0.08] hover:bg-transparent">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Tümünü seç"
                    className="align-middle rounded-md"
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(on) => setSelected(on === true ? new Set(filtered.map((r) => r.id)) : new Set())}
                    disabled={!filtered.length}
                  />
                </TableHead>
                <SortHead label="Tarih" column="tarih" sort={sort} onSort={toggleSort} />
                <SortHead label="Firma & Fiş No" column="firma_adi" sort={sort} onSort={toggleSort} />
                <SortHead label="Kategori" column="kategori" sort={sort} onSort={toggleSort} />
                <SortHead label="KDV Tutarı" column="toplam_kdv" sort={sort} onSort={toggleSort} align="right" />
                <SortHead label="Toplam Tutar" column="toplam_tutar" sort={sort} onSort={toggleSort} align="right" />
                <TableHead className="w-28 pr-4 text-right">Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i} className="border-b border-border/40 dark:border-white/[0.04]">
                    <TableCell colSpan={7} className="px-4 py-3.5">
                      <Skeleton className="h-6 w-full rounded-xl" />
                    </TableCell>
                  </TableRow>
                ))}

              {!loading &&
                visible.map((r) => {
                  const href = `/fisler/detay/?id=${encodeURIComponent(r.id)}`;
                  const catVisual = getCategoryVisuals(r.kategori);
                  const isDelivered = isSent(r);

                  return (
                    <TableRow
                      key={r.id}
                      data-state={selected.has(r.id) ? "selected" : undefined}
                      className="cursor-pointer border-b border-border/40 dark:border-white/[0.05] hover:bg-muted/30 transition-colors duration-150 group"
                      onClick={() => router.push(href)}
                    >
                      <TableCell className="pl-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          aria-label={`${r.firma_adi} seç`}
                          className="align-middle rounded-md"
                          checked={selected.has(r.id)}
                          onCheckedChange={(on) => toggleRow(r.id, on === true)}
                        />
                      </TableCell>

                      {/* Tarih */}
                      <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                        {isoToTrDate(r.tarih)}
                      </TableCell>

                      {/* Firma, Squircle Monogram & Fiş No */}
                      <TableCell className="max-w-72">
                        <Link
                          href={href}
                          className="flex items-center gap-2.5 truncate font-medium group-hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className={cn(
                              "size-8 rounded-xl flex items-center justify-center text-xs font-bold shadow-xs shrink-0 select-none",
                              catVisual.squircle,
                            )}
                          >
                            <span>
                              {r.firma_adi ? r.firma_adi.slice(0, 2).toLocaleUpperCase("tr-TR") : catVisual.initial}
                            </span>
                          </div>
                          <div className="truncate">
                            <div className="truncate font-semibold text-foreground text-xs md:text-sm">
                              {r.firma_adi || "İsimsiz Firma"}
                            </div>
                            {r.fis_no && (
                              <div className="text-[11px] text-muted-foreground tabular-nums">Fiş: #{r.fis_no}</div>
                            )}
                          </div>
                          {r.image_path && (
                            <ImageIcon className="size-3.5 shrink-0 text-muted-foreground/70" aria-label="Fotoğraflı" />
                          )}
                        </Link>
                      </TableCell>

                      {/* Kategori Dual-Tone Segmentli Rozet (Option 04) */}
                      <TableCell>
                        <CategoryBadge category={r.kategori} />
                      </TableCell>

                      {/* KDV Tutarı */}
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {formatTL(r.toplam_kdv)} TL
                      </TableCell>

                      {/* Toplam Tutar */}
                      <TableCell className="text-right text-sm font-bold tabular-nums text-foreground">
                        {formatTL(r.toplam_tutar)} TL
                      </TableCell>

                      {/* Muhasebe Durumu */}
                      <TableCell className="pr-4 text-right">
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Check className="size-3 stroke-[2.5]" /> Gönderildi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <span className="size-1.5 rounded-full bg-amber-500"></span> Bekliyor
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

              {/* Apple-style Boş Durum (Empty State) */}
              {!loading && !filtered.length && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-20 text-center">
                    <div className="max-w-md mx-auto space-y-3.5">
                      <div className="size-14 rounded-3xl bg-gradient-to-tr from-sky-500/20 to-blue-500/20 text-sky-500 flex items-center justify-center mx-auto border border-sky-500/20 shadow-xs">
                        <Receipt className="size-7 stroke-[1.75]" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-semibold text-foreground">
                          {loaded?.error
                            ? "Fişler Yüklenemedi"
                            : rows.length
                              ? "Aramanıza Uygun Fiş Bulunamadı"
                              : "Bu Dönemde Henüz Fiş Yok"}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {loaded?.error
                            ? loaded.error
                            : rows.length
                              ? "Farklı bir arama terimi veya kategori filtresi deneyebilirsiniz."
                              : "Seçili dönemde kayıtlı bir harcama veya POS fişi bulunmuyor. Yeni bir fiş ekleyerek başlayabilirsiniz."}
                        </p>
                      </div>
                      {!rows.length && !loaded?.error && (
                        <div className="pt-1">
                          <Button
                            asChild
                            size="sm"
                            className="rounded-full bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-medium shadow-sm gap-1.5"
                          >
                            <Link href="/fisler/yeni/">
                              <Plus className="size-3.5" /> Yeni Fiş Tara
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sayfalama Kontrolleri */}
      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground tabular-nums">
          <span>
            {currentPage * PAGE_SIZE + 1}–{Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE)} / {filtered.length}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Önceki sayfa"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            className="size-7 rounded-lg"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Sonraki sayfa"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
            className="size-7 rounded-lg"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Silme Onay Modalı */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedRows.length} fiş silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Fişler Son Silinenler&apos;e taşınır ve 30 gün içinde geri alınabilir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "delete"} className="rounded-xl">
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy === "delete"}
              className="rounded-xl"
              onClick={(e) => {
                e.preventDefault();
                void onDelete();
              }}
            >
              {busy === "delete" ? "Siliniyor…" : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortHead({
  label,
  column,
  sort,
  onSort,
  align,
}: {
  label: string;
  column: SortColumn;
  sort: SortState;
  onSort: (c: SortColumn) => void;
  align?: "right";
}) {
  const active = sort.column === column;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={cn(align === "right" && "text-right")}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn("-mx-2 h-7 px-2 text-xs font-semibold hover:bg-muted/60 rounded-lg", align === "right" && "-mr-2 ml-auto")}
        onClick={() => onSort(column)}
      >
        {label}
        <Icon className={cn("size-3", !active && "text-muted-foreground/60")} />
      </Button>
    </TableHead>
  );
}
