"use client";

import { allCategories, categoryLabel } from "@shared/lib/categories";
import { formatTL, isoToTrDate } from "@shared/lib/format";
import { periodRange } from "@shared/lib/period";
import { receiptMatcher } from "@shared/lib/search";
import { isSent, summarizeReceipts } from "@shared/lib/summary";
import type { ReceiptRecord } from "@shared/types/receipt";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Filter,
  Image as ImageIcon,
  Package,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteReceipt, listReceipts, loadCustomCategories, markReceiptsSent } from "@/lib/receipts";
import { exportExcel, exportPackage } from "@/lib/receiptExport";
import { periodFromKey, periodOptions, sortRows, type SortColumn, type SortState } from "@/lib/receiptTable";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type Loaded = { key: string; rows: ReceiptRecord[]; error?: string };

export function ReceiptsView() {
  const router = useRouter();
  const [periodKey, setPeriodKey] = useState("m0");
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

  const period = useMemo(() => periodFromKey(periodKey), [periodKey]);
  const range = useMemo(() => periodRange(period), [period]);
  const options = useMemo(() => periodOptions(), []);
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
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Fişler"
        description={exportLabel}
        actions={
          <Button asChild size="sm">
            <Link href="/fisler/yeni/">
              <Plus /> Yeni Fiş
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Toplam gider" value={formatTL(summary.toplamGider)} loading={loading} />
        <Stat title="Toplam KDV" value={formatTL(summary.toplamKdv)} hint={`%1 ${formatTL(summary.kdv1)} · %10 ${formatTL(summary.kdv10)} · %20 ${formatTL(summary.kdv20)}`} loading={loading} />
        <Stat title="Fiş sayısı" value={String(summary.fisSayisi)} loading={loading} />
        <Stat title="Muhasebeye gönderilen" value={`${sentCount} / ${summary.fisSayisi}`} loading={loading} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetView();
            }}
            placeholder="Firma, not, etiket, tutar…"
            className="pl-8"
            aria-label="Fişlerde ara"
          />
        </div>
        <Select
          value={periodKey}
          onValueChange={(v) => {
            setPeriodKey(v);
            resetView();
          }}
        >
          <SelectTrigger className="w-44" aria-label="Dönem">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter /> Kategori
              {catFilter.size > 0 && <Badge variant="secondary">{catFilter.size}</Badge>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
            <DropdownMenuLabel>Kategoriler</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {categories.map((k) => (
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
              >
                {categoryLabel(k)}
              </DropdownMenuCheckboxItem>
            ))}
            {catFilter.size > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setCatFilter(new Set())}>
                  <X /> Filtreyi temizle
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={onExcel} disabled={!exportRows.length || !!busy}>
            <FileSpreadsheet /> Excel
          </Button>
          <Button variant="outline" onClick={onPackage} disabled={!exportRows.length || !!busy}>
            <Package /> Paket (ZIP)
          </Button>
        </div>
      </div>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{selectedRows.length} fiş seçildi</span>
          <span className="text-muted-foreground">· {formatTL(summarizeReceipts(selectedRows).toplamGider)}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onMarkSent(true)} disabled={!!busy}>
              <Send /> Gönderildi işaretle
            </Button>
            <Button size="sm" variant="outline" onClick={() => onMarkSent(false)} disabled={!!busy}>
              <X /> İşareti kaldır
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
              <Trash2 /> Sil
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Seçimi temizle
            </Button>
          </div>
        </div>
      )}

      <Card className="py-0">
        <CardContent className="px-0">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Tümünü seç"
                    className="align-middle"
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(on) => setSelected(on === true ? new Set(filtered.map((r) => r.id)) : new Set())}
                    disabled={!filtered.length}
                  />
                </TableHead>
                <SortHead label="Tarih" column="tarih" sort={sort} onSort={toggleSort} />
                <SortHead label="Firma" column="firma_adi" sort={sort} onSort={toggleSort} />
                <SortHead label="Kategori" column="kategori" sort={sort} onSort={toggleSort} />
                <SortHead label="KDV" column="toplam_kdv" sort={sort} onSort={toggleSort} align="right" />
                <SortHead label="Tutar" column="toplam_tutar" sort={sort} onSort={toggleSort} align="right" />
                <TableHead className="w-24 pr-4 text-right">Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="px-4">
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!loading &&
                visible.map((r) => {
                  const href = `/fisler/detay/?id=${encodeURIComponent(r.id)}`;
                  return (
                    <TableRow
                      key={r.id}
                      data-state={selected.has(r.id) ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => router.push(href)}
                    >
                      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          aria-label={`${r.firma_adi} seç`}
                          className="align-middle"
                          checked={selected.has(r.id)}
                          onCheckedChange={(on) => toggleRow(r.id, on === true)}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">{isoToTrDate(r.tarih)}</TableCell>
                      <TableCell className="max-w-72">
                        <Link href={href} className="flex items-center gap-1.5 truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                          <span className="truncate">{r.firma_adi}</span>
                          {r.image_path && <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Fotoğraflı" />}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{categoryLabel(r.kategori)}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{formatTL(r.toplam_kdv)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatTL(r.toplam_tutar)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        {isSent(r) && (
                          <Badge variant="secondary">
                            <Check /> Gönderildi
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!loading && !filtered.length && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                    {loaded?.error
                      ? `Fişler yüklenemedi: ${loaded.error}`
                      : rows.length
                        ? "Aramanıza uyan fiş yok."
                        : "Bu dönemde fiş yok."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>
            {currentPage * PAGE_SIZE + 1}–{Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE)} / {filtered.length}
          </span>
          <Button variant="outline" size="icon-sm" aria-label="Önceki sayfa" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Sonraki sayfa" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>
            <ChevronRight />
          </Button>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedRows.length} fiş silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Fişler Son Silinenler&apos;e taşınır ve 30 gün içinde geri alınabilir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "delete"}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy === "delete"}
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

function Stat({ title, value, hint, loading }: { title: string; value: string; hint?: string; loading: boolean }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{loading ? <Skeleton className="h-7 w-28" /> : value}</CardTitle>
        {hint && !loading && <p className="text-xs text-muted-foreground tabular-nums">{hint}</p>}
      </CardHeader>
    </Card>
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
    <TableHead className={cn(align === "right" && "text-right")} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Button variant="ghost" size="sm" className={cn("-mx-2 h-7 px-2", align === "right" && "-mr-2 ml-auto")} onClick={() => onSort(column)}>
        {label}
        <Icon className={cn("size-3.5", !active && "text-muted-foreground/60")} />
      </Button>
    </TableHead>
  );
}
