"use client";

import { formatTL, isoToTrDate } from "@shared/lib/format";
import type { ReceiptRecord } from "@shared/types/receipt";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  GitMerge,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, ListBox, SearchField, Select, Skeleton, Table, toast } from "@heroui/react";
import { PageHeader } from "@/components/layout/page-header";
import { filterFirmsByName, getFirmMergeSuggestions, loadFirmList, type FirmGroup, type FirmListItem } from "@/lib/firms";
import { FirmMergeDialog } from "./firm-merge-dialog";

const PAGE_SIZE = 50;

type SortOption = "total" | "count" | "name" | "date";

export function FirmsView() {
  const [firms, setFirms] = useState<FirmListItem[]>([]);
  const [allReceipts, setAllReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("total");
  const [page, setPage] = useState(0);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  const fetchFirms = () => {
    void loadFirmList()
      .then((res) => {
        setFirms(res.firms);
        setAllReceipts(res.allReceipts);
      })
      .catch((err) => {
        toast.danger(err instanceof Error ? err.message : "Firmalar yüklenemedi.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchFirms();
  }, []);

  // Birleştirme önerileri
  const mergeGroups = useMemo<FirmGroup[]>(() => {
    if (allReceipts.length === 0) return [];
    return getFirmMergeSuggestions(allReceipts);
  }, [allReceipts]);

  // Filtreleme ve Sıralama
  const filteredFirms = useMemo(() => {
    let list = firms;

    list = filterFirmsByName(list, search);

    return [...list].sort((a, b) => {
      if (sortOption === "total") return b.total - a.total;
      if (sortOption === "count") return b.count - a.count;
      if (sortOption === "name") return a.name.localeCompare(b.name, "tr");
      if (sortOption === "date") return (b.last ?? "").localeCompare(a.last ?? "");
      return 0;
    });
  }, [firms, search, sortOption]);

  const totalSpent = useMemo(() => {
    return firms.reduce((acc, f) => acc + f.total, 0);
  }, [firms]);

  const pageCount = Math.max(1, Math.ceil(filteredFirms.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedRows = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredFirms.slice(start, start + PAGE_SIZE);
  }, [filteredFirms, currentPage]);

  return (
    <div className="space-y-6">
      {/* Üst Başlık ve Birleştir Butonu */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Firmalar"
          description="Alışveriş yaptığınız tüm işletmeler, toplam harcamalarınız ve fiş adetleri."
        />

        <Button size="sm"
          type="button"
          variant="outline"
          onPress={() => setMergeDialogOpen(true)}
          className="gap-2"
        >
          <GitMerge className="size-4 text-accent" />
          Firma Adlarını Birleştir
          {mergeGroups.length > 0 && (
            <Chip size="sm" variant="secondary" className="ml-1">
              {mergeGroups.length}
            </Chip>
          )}
        </Button>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Description>Kayıtlı Firma Sayısı</Card.Description>
            <Card.Title className="text-2xl tabular-nums">
              {loading ? <Skeleton className="h-7 w-20" /> : `${firms.length} firma`}
            </Card.Title>
          </Card.Header>
        </Card>

        <Card>
          <Card.Header>
            <Card.Description>Firmalara Yapılan Toplam Harcama</Card.Description>
            <Card.Title className="text-2xl tabular-nums">
              {loading ? <Skeleton className="h-7 w-32" /> : `${formatTL(totalSpent)}`}
            </Card.Title>
          </Card.Header>
        </Card>

        <Card>
          <Card.Header>
            <Card.Description>Ortalama Firma Başına Harcama</Card.Description>
            <Card.Title className="text-2xl tabular-nums">
              {loading ? (
                <Skeleton className="h-7 w-28" />
              ) : firms.length > 0 ? (
                `${formatTL(totalSpent / firms.length)}`
              ) : (
                "—"
              )}
            </Card.Title>
          </Card.Header>
        </Card>
      </div>

      {/* Arama ve Sıralama Çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          aria-label="Firmalarda ara"
          className="min-w-64 max-w-sm flex-1"
          value={search}
          onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Firma adına göre filtrele…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <Select className="w-52" placeholder="Sıralama" aria-label="Sıralama"
          value={sortOption}
          onChange={(key) => {
            const val = String(key);
            setSortOption(val as SortOption);
            setPage(0);
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="total">
                En Yüksek Harcama
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="count">
                En Çok Fiş Sayısı
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="name">
                Firma Adı (A–Z)
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="date">
                En Son Alışveriş Tarihi
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
        </Select.Popover>
        </Select>
      </div>

      {/* Firma Tablosu */}
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Firmalar" className="min-w-[640px]">
            <Table.Header>
              <Table.Column isRowHeader className="w-12">#</Table.Column>
              <Table.Column>Firma Adı</Table.Column>
              <Table.Column className="w-32 text-right">Fiş Sayısı</Table.Column>
              <Table.Column className="w-40 text-right">KDV Toplamı</Table.Column>
              <Table.Column className="w-44 text-right">Toplam Harcama</Table.Column>
              <Table.Column className="w-36 text-right">Son Fiş Tarihi</Table.Column>
            </Table.Header>
            <Table.Body>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <Table.Row key={i} id={i}>
                    <Table.Cell>
                      <Skeleton className="h-4 w-4" />
                    </Table.Cell>
                    <Table.Cell>
                      <Skeleton className="h-4 w-48" />
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Skeleton className="ml-auto h-4 w-24" />
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </Table.Cell>
                  </Table.Row>
                ))}

              {!loading &&
                pagedRows.map((firm, idx) => (
                  <Table.Row key={firm.key} id={firm.key}>
                    <Table.Cell className="text-xs tabular-nums text-muted">
                      {currentPage * PAGE_SIZE + idx + 1}
                    </Table.Cell>
                    <Table.Cell className="font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-muted/60 shrink-0" />
                        <span className="truncate">{firm.name}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-right tabular-nums text-muted">
                      {firm.count} fiş
                    </Table.Cell>
                    <Table.Cell className="text-right tabular-nums text-muted">
                      {formatTL(firm.kdv)}
                    </Table.Cell>
                    <Table.Cell className="text-right font-semibold tabular-nums text-foreground">
                      {formatTL(firm.total)}
                    </Table.Cell>
                    <Table.Cell className="text-right tabular-nums text-xs text-muted">
                      {firm.last ? isoToTrDate(firm.last) : "—"}
                    </Table.Cell>
                  </Table.Row>
                ))}

              {!loading && filteredFirms.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={6} className="text-center text-sm text-muted">
                    {search ? "Aramanıza uyan firma bulunamadı." : "Henüz kayıtlı firma bulunmuyor."}
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {/* Sayfalama */}
      {!loading && filteredFirms.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Toplam {filteredFirms.length} firmadan {currentPage * PAGE_SIZE + 1}–
            {Math.min(filteredFirms.length, (currentPage + 1) * PAGE_SIZE)} arası gösteriliyor
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

      {/* Firma Birleştirme Dialogu */}
      <FirmMergeDialog
        groups={mergeGroups}
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        onMerged={() => {
          fetchFirms();
          setMergeDialogOpen(false);
        }}
      />
    </div>
  );
}
