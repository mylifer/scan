"use client";

import { allCategories, categoryLabel } from "@shared/lib/categories";
import { formatTL, isoToTrDate } from "@shared/lib/format";
import { periodRange, stepPeriod, switchMode, type Period } from "@shared/lib/period";
import { receiptMatcher } from "@shared/lib/search";
import { isSent, summarizeReceipts } from "@shared/lib/summary";
import type { ReceiptRecord } from "@shared/types/receipt";
import {
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
  Send,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertDialog, Button, Card, Checkbox, Chip, Dropdown, Header, Label, SearchField, type Selection, Skeleton, Table, Tabs, toast, ProgressBar, Tag, TagGroup } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { deleteReceipt, listReceipts, loadCustomCategories, markReceiptsSent } from "@/lib/receipts";
import { exportExcel, exportPackage } from "@/lib/receiptExport";
import { sortRows, type SortColumn, type SortState } from "@/lib/receiptTable";
import { CategoryBadge, getCategoryVisuals } from "@/components/category-badge";
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

  function resetView() {
    setSelected(new Set());
    setPage(0);
  }

  function toggleSort(column: SortColumn) {
    setSort((s) => (s.column === column ? { column, dir: s.dir === "asc" ? "desc" : "asc" } : { column, dir: column === "firma_adi" || column === "kategori" ? "asc" : "desc" }));
  }

  // Başlıktaki "tümünü seç" sayfadakileri değil, filtrelenmiş TÜM fişleri seçer.
  function onTableSelection(keys: Selection) {
    setSelected(keys === "all" ? new Set(filtered.map((r) => r.id)) : new Set([...keys].map(String)));
  }

  const exportRows = selectedRows.length ? selectedRows : filtered;
  const exportLabel = range?.label ?? "Tüm zamanlar";

  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      toast.danger(e instanceof Error ? e.message : String(e));
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
      const id = toast("Paket hazırlanıyor…", { isLoading: true, timeout: 0 });
      try {
        const res = await exportPackage(exportRows, exportLabel, range?.fileTag, (d, t) => {
          toast.update(id, `Fotoğraflar indiriliyor… ${d}/${t}`, { isLoading: true, timeout: 0 });
        });
        toast.update(id, `Paket hazır: ${res.photos} fotoğraf${res.failed ? `, ${res.failed} indirilemedi` : ""}`, {
          variant: "success",
          isLoading: false,
          timeout: 4000,
        });
      } catch (err) {
        toast.close(id);
        throw err;
      }
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
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/15">
              {exportLabel}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Taranan harcama ve POS fişlerinin konsolide dökümü, vergi ve muhasebe takibi
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/fisler/yeni/"
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="size-4 stroke-[2.5]" />
            <span>Yeni Fiş</span>
          </Link>
        </div>
      </div>

      {/* Apple Native Glass Metrik Kartları (Tahoe Glass) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Kart 1: Toplam Harcama */}
        <Card className="relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center shadow-sm shadow-sky-500/25">
              <CreditCard className="size-4.5 stroke-[2]" />
            </div>
            <Chip size="sm" variant="soft" color="accent" className="tabular-nums">
              {summary.fisSayisi} Fiş
            </Chip>
          </div>
          <div className="text-xs font-medium text-muted">Toplam Harcama</div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-0.5">
            {loading ? <Skeleton className="h-7 w-28 my-0.5" /> : `${formatTL(summary.toplamGider)}`}
          </div>
          <div className="text-[11px] text-muted mt-1 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-sky-500"></span>
            <span>Kayıtlı brüt gider toplamı</span>
          </div>
        </Card>

        {/* Kart 2: İndirilebilir KDV */}
        <Card className="relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-sm shadow-emerald-500/25">
              <ReceiptText className="size-4.5 stroke-[2]" />
            </div>
            <Chip size="sm" variant="soft" color="success">
              KDV İndirimi
            </Chip>
          </div>
          <div className="text-xs font-medium text-muted">Düşülebilir Toplam KDV</div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
            {loading ? <Skeleton className="h-7 w-28 my-0.5" /> : `${formatTL(summary.toplamKdv)}`}
          </div>
          <div className="text-[11px] text-muted mt-1 tabular-nums truncate">
            %1: {formatTL(summary.kdv1)} · %10: {formatTL(summary.kdv10)} · %20: {formatTL(summary.kdv20)}
          </div>
        </Card>

        {/* Kart 3: Muhasebeye Teslim Oranı */}
        <Card className="relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-sm shadow-indigo-500/25">
              <CheckCircle2 className="size-4.5 stroke-[2]" />
            </div>
            <Chip size="sm" variant="soft" color="accent" className="tabular-nums">
              %{summary.fisSayisi > 0 ? Math.round((sentCount / summary.fisSayisi) * 100) : 0} Oran
            </Chip>
          </div>
          <div className="text-xs font-medium text-muted">Muhasebeye Teslim Edilen</div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-0.5">
            {loading ? <Skeleton className="h-7 w-24 my-0.5" /> : `${sentCount} / ${summary.fisSayisi}`}
          </div>
          <ProgressBar
            aria-label="Muhasebeye teslim oranı"
            size="sm"
            className="mt-2"
            value={summary.fisSayisi > 0 ? (sentCount / summary.fisSayisi) * 100 : 0}
          >
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </Card>

        {/* Kart 4: İşlem Bekleyen Fişler */}
        <Card className="relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-sm shadow-amber-500/25">
              <Clock className="size-4.5 stroke-[2]" />
            </div>
            {pendingCount > 0 ? (
              <Chip size="sm" variant="soft" color="warning">
                İşlem Bekliyor
              </Chip>
            ) : (
              <Chip size="sm" variant="soft" color="success">
                Eksik Yok
              </Chip>
            )}
          </div>
          <div className="text-xs font-medium text-muted">Teslim Bekleyen Fişler</div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-0.5">
            {loading ? <Skeleton className="h-7 w-20 my-0.5" /> : `${pendingCount} Fiş`}
          </div>
          <div className="text-[11px] text-muted mt-1">
            {pendingCount > 0 ? "Gönderilince önceki ayın KDV'sinden düşer" : "Tüm fişler muhasebeleştirildi"}
          </div>
        </Card>
      </div>

      {/* Apple Spotlight Arama, Segmented Switch & Filtre Araç Çubuğu */}
      <Card className="flex flex-row flex-wrap items-center gap-2.5">
        {/* Spotlight Tarzı Arama Alanı */}
        <SearchField
          aria-label="Fişlerde ara"
          className="flex-1 min-w-[220px] max-w-sm"
          value={query}
          onChange={(v) => {
              setQuery(v);
              resetView();
            }}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Firma, not, etiket, tutar ara…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {/* Dönem seçici (HeroUI Tabs) */}
        <Tabs className="w-fit shrink-0"
          selectedKey={period.mode}
          onSelectionChange={(key) => {
            setPeriod((p) => switchMode(p, key as Period["mode"]));
            resetView();
          }}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Dönem">
                <Tabs.Tab id="all" className="whitespace-nowrap">
                  Tüm Zamanlar
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="month" className="whitespace-nowrap">
                  Aylık
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="year" className="whitespace-nowrap">
                  Yıllık
                  <Tabs.Indicator />
                </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>

        {/* İleri/Geri Butonları (Aylık/Yıllık seçildiğinde belirir) */}
        {period.mode !== "all" && (
          <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/80 px-1.5 h-8 shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm" isIconOnly
             
              onPress={() => {
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
              size="sm" isIconOnly
             
              isDisabled={period.offset >= 0}
              onPress={() => {
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
        <Dropdown>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5",
              )}
            >
              <Filter className="size-3.5" /> Kategori
              {catFilter.size > 0 && (
                <Chip size="sm" variant="soft" className="tabular-nums">
                  {catFilter.size}
                </Chip>
              )}
            </Button>
          <Dropdown.Popover placement="bottom start" className="max-h-80 w-60 overflow-y-auto">
            <Dropdown.Menu
              aria-label="Kategoriye göre filtrele"
              onAction={(key) => {
                if (key === "__temizle") {
                  setCatFilter(new Set());
                  resetView();
                }
              }}
            >
              <Dropdown.Section
                selectionMode="multiple"
                selectedKeys={catFilter}
                onSelectionChange={(keys) => {
                  setCatFilter(keys === "all" ? new Set(categories) : new Set([...keys].map(String)));
                  resetView();
                }}
              >
                <Header className="text-xs font-semibold">Kategoriye Göre Filtrele</Header>
                {categories.map((k) => {
                  const v = getCategoryVisuals(k);
                  return (
                    <Dropdown.Item key={k} id={k} textValue={categoryLabel(k)}>
                      <span className={cn("size-2 rounded-full shrink-0", v.dotColor)} />
                      <span className="text-[10px] font-bold text-muted w-4">{v.initial}</span>
                      <Label className="text-xs">{categoryLabel(k)}</Label>
                      <Dropdown.ItemIndicator className="ms-auto" />
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Section>
              {catFilter.size > 0 ? (
                <Dropdown.Section>
                  <Dropdown.Item id="__temizle" textValue="Filtreyi temizle" variant="danger">
                    <X className="size-3.5" />
                    <Label className="text-xs">Filtreyi temizle</Label>
                  </Dropdown.Item>
                </Dropdown.Section>
              ) : null}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        {/* Dışa Aktarım Düğmeleri */}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onPress={onExcel}
            isDisabled={!exportRows.length || !!busy}
            className="gap-1.5"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={onPackage}
            isDisabled={!exportRows.length || !!busy}
            className="gap-1.5"
          >
            <Package className="size-3.5 text-sky-600 dark:text-sky-400" /> Paket (ZIP)
          </Button>
        </div>
      </Card>

      {/* Aktif kategori filtreleri (HeroUI TagGroup, X ile kaldırılır) */}
      {catFilter.size > 0 && (
        <Card className="flex flex-row flex-wrap items-center gap-2">
          <TagGroup
            aria-label="Filtrelenen kategoriler"
            onRemove={(keys) => {
              setCatFilter((s) => new Set([...s].filter((k) => !keys.has(k))));
              resetView();
            }}
          >
            <Label>Filtrelenen Kategoriler</Label>
            <TagGroup.List>
              {Array.from(catFilter).map((k) => (
                <Tag key={k} id={k} textValue={categoryLabel(k)}>
                  <span className={cn("size-2 rounded-full shrink-0", getCategoryVisuals(k).dotColor)} />
                  {categoryLabel(k)}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPress={() => {
              setCatFilter(new Set());
              resetView();
            }}
            className="ml-auto"
          >
            Tümünü Kaldır
          </Button>
        </Card>
      )}

      {/* Çoklu Seçim Eylem Şeridi */}
      {selectedRows.length > 0 && (
        <Card className="flex flex-row flex-wrap items-center gap-2 text-sm animate-in fade-in-50">
          <span className="font-semibold text-foreground">{selectedRows.length} fiş seçildi</span>
          <span className="text-muted tabular-nums">· {formatTL(summarizeReceipts(selectedRows).toplamGider)}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onPress={() => onMarkSent(true)} isDisabled={!!busy}>
              <Send className="size-3.5" /> Gönderildi işaretle
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onPress={() => onMarkSent(false)} isDisabled={!!busy}>
              <X className="size-3.5" /> İşareti kaldır
            </Button>
            <Button size="sm" variant="danger-soft" className="gap-1.5" onPress={() => setConfirmDelete(true)} isDisabled={!!busy}>
              <Trash2 className="size-3.5" /> Sil
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setSelected(new Set())}>
              Seçimi temizle
            </Button>
          </div>
        </Card>
      )}

      {/* Apple Glass Fiş Tablosu */}
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Fişler" className="min-w-[700px]"
            selectionMode="multiple"
              selectedKeys={selected}
              onSelectionChange={onTableSelection}
              disabledKeys={loading ? Array.from({ length: 6 }, (_, i) => `iskelet-${i}`) : ["bos"]}
              sortDescriptor={{ column: sort.column, direction: sort.dir === "asc" ? "ascending" : "descending" }}
            onSortChange={(d) => toggleSort(d.column as SortColumn)}
          >
            <Table.Header>
              <Table.Column className="w-10">
                <Checkbox
                  slot="selection"
                  aria-label="Tümünü seç"
                  variant="secondary"
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>
              </Table.Column>
              <SortHead label="Tarih" column="tarih" />
              <SortHead label="Firma & Fiş No" column="firma_adi" isRowHeader />
              <SortHead label="Kategori" column="kategori" />
              <SortHead label="KDV Tutarı" column="toplam_kdv" align="right" />
              <SortHead label="Toplam Tutar" column="toplam_tutar" align="right" />
              <Table.Column className="w-28 text-right">Durum</Table.Column>
            </Table.Header>
            <Table.Body>
              {loading &&
                Array.from({ length: 6 }, (_, i) => (
                  <Table.Row key={i} id={`iskelet-${i}`}>
                    <Table.Cell colSpan={7}>
                      <Skeleton className="h-6 w-full rounded-xl" />
                    </Table.Cell>
                  </Table.Row>
                ))}

              {!loading &&
                visible.map((r) => {
                  const href = `/fisler/detay/?id=${encodeURIComponent(r.id)}`;
                  const catVisual = getCategoryVisuals(r.kategori);
                  const isDelivered = isSent(r);

                  return (
                    <Table.Row
                      key={r.id}
                      id={r.id}
                      onAction={() => router.push(href)}
                    >
                      <Table.Cell>
                        <Checkbox
                          slot="selection"
                          aria-label={`${r.firma_adi} seç`}
                          variant="secondary"
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                      </Table.Cell>

                      {/* Tarih */}
                      <Table.Cell className="tabular-nums text-xs text-muted whitespace-nowrap">
                        {isoToTrDate(r.tarih)}
                      </Table.Cell>

                      {/* Firma, Squircle Monogram & Fiş No */}
                      <Table.Cell className="max-w-72">
                        <Link
                          href={href}
                          className="flex items-center gap-2.5 truncate font-medium group-hover:text-accent transition-colors"
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
                              <div className="text-[11px] text-muted tabular-nums">Fiş: #{r.fis_no}</div>
                            )}
                          </div>
                          {r.image_path && (
                            <ImageIcon className="size-3.5 shrink-0 text-muted/70" aria-label="Fotoğraflı" />
                          )}
                        </Link>
                      </Table.Cell>

                      {/* Kategori Minimalist Monogram & Status Dot Rozeti (Option 02) */}
                      <Table.Cell>
                        <CategoryBadge category={r.kategori} />
                      </Table.Cell>

                      {/* KDV Tutarı */}
                      <Table.Cell className="text-right text-xs text-muted tabular-nums">
                        {formatTL(r.toplam_kdv)}
                      </Table.Cell>

                      {/* Toplam Tutar */}
                      <Table.Cell className="text-right text-sm font-bold tabular-nums text-foreground">
                        {formatTL(r.toplam_tutar)}
                      </Table.Cell>

                      {/* Muhasebe Durumu */}
                      <Table.Cell className="text-right">
                        {isDelivered ? (
                          <Chip size="sm" variant="soft" color="success">
                            <Check className="size-3 stroke-[2.5]" /> Gönderildi
                          </Chip>
                        ) : (
                          <Chip size="sm" variant="soft" color="warning">
                            <span className="size-1.5 rounded-full bg-amber-500"></span> Bekliyor
                          </Chip>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}

              {/* Apple-style Boş Durum (Empty State) */}
              {!loading && !filtered.length && (
                <Table.Row id="bos">
                  <Table.Cell colSpan={7} className="text-center">
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
                        <p className="text-xs text-muted leading-relaxed">
                          {loaded?.error
                            ? loaded.error
                            : rows.length
                              ? "Farklı bir arama terimi veya kategori filtresi deneyebilirsiniz."
                              : "Seçili dönemde kayıtlı bir harcama veya POS fişi bulunmuyor. Yeni bir fiş ekleyerek başlayabilirsiniz."}
                        </p>
                      </div>
                      {!rows.length && !loaded?.error && (
                        <div className="pt-1">
                          <Link
                            href="/fisler/yeni/"
                            className={buttonVariants({ size: "sm" })}
                          >
                            <Plus className="size-3.5" /> Yeni Fiş Tara
                          </Link>
                        </div>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {/* Sayfalama Kontrolleri */}
      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted tabular-nums">
          <span>
            {currentPage * PAGE_SIZE + 1}–{Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE)} / {filtered.length}
          </span>
          <Button
            variant="outline"
            size="sm" isIconOnly
            aria-label="Önceki sayfa"
            isDisabled={currentPage === 0}
            onPress={() => setPage(currentPage - 1)}
            className="size-7"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm" isIconOnly
            aria-label="Sonraki sayfa"
            isDisabled={currentPage >= pageCount - 1}
            onPress={() => setPage(currentPage + 1)}
            className="size-7"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Silme Onay Modalı */}
      <AlertDialog.Backdrop isOpen={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>{selectedRows.length} fiş silinsin mi?</AlertDialog.Heading>
              <p className="text-sm text-muted">
                Fişler Son Silinenler&apos;e taşınır ve 30 gün içinde geri alınabilir.
              </p>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary" size="sm" isDisabled={busy === "delete"}>
                Vazgeç
              </Button>
              <Button size="sm"
                variant="danger"
                isDisabled={busy === "delete"}
                onPress={() => {
                  void onDelete();
                }}
              >
                {busy === "delete" ? "Siliniyor…" : "Sil"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}

function SortHead({
  label,
  column,
  align,
  isRowHeader,
  className,
}: {
  label: string;
  column: SortColumn;
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
