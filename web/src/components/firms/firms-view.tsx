"use client";

import { formatTL, isoToTrDate } from "@shared/lib/format";
import type { ReceiptRecord } from "@shared/types/receipt";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  GitMerge,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getFirmMergeSuggestions, loadFirmList, type FirmGroup, type FirmListItem } from "@/lib/firms";
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
        toast.error(err instanceof Error ? err.message : "Firmalar yüklenemedi.");
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

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }

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

        <Button
          type="button"
          variant="outline"
          onClick={() => setMergeDialogOpen(true)}
          className="gap-2"
        >
          <GitMerge className="size-4 text-primary" />
          Firma Adlarını Birleştir
          {mergeGroups.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[11px]">
              {mergeGroups.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardDescription>Kayıtlı Firma Sayısı</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {loading ? <Skeleton className="h-7 w-20" /> : `${firms.length} firma`}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-2">
            <CardDescription>Firmalara Yapılan Toplam Harcama</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {loading ? <Skeleton className="h-7 w-32" /> : `${formatTL(totalSpent)} TL`}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-2">
            <CardDescription>Ortalama Firma Başına Harcama</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {loading ? (
                <Skeleton className="h-7 w-28" />
              ) : firms.length > 0 ? (
                `${formatTL(totalSpent / firms.length)} TL`
              ) : (
                "—"
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Arama ve Sıralama Çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-64 max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Firma adına göre filtrele…"
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

        <Select
          value={sortOption}
          onValueChange={(val) => {
            setSortOption(val as SortOption);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Sıralama" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="total">En Yüksek Harcama</SelectItem>
            <SelectItem value="count">En Çok Fiş Sayısı</SelectItem>
            <SelectItem value="name">Firma Adı (A–Z)</SelectItem>
            <SelectItem value="date">En Son Alışveriş Tarihi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Firma Tablosu */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 pl-4">#</TableHead>
                <TableHead>Firma Adı</TableHead>
                <TableHead className="w-32 text-right">Fiş Sayısı</TableHead>
                <TableHead className="w-40 text-right">KDV Toplamı</TableHead>
                <TableHead className="w-44 text-right">Toplam Harcama</TableHead>
                <TableHead className="w-36 pr-4 text-right">Son Fiş Tarihi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-4">
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-24" />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))}

              {!loading &&
                pagedRows.map((firm, idx) => (
                  <TableRow key={firm.key}>
                    <TableCell className="pl-4 text-xs tabular-nums text-muted-foreground">
                      {currentPage * PAGE_SIZE + idx + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-muted-foreground/60 shrink-0" />
                        <span className="truncate">{firm.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {firm.count} fiş
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatTL(firm.kdv)} TL
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground">
                      {formatTL(firm.total)} TL
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums text-xs text-muted-foreground">
                      {firm.last ? isoToTrDate(firm.last) : "—"}
                    </TableCell>
                  </TableRow>
                ))}

              {!loading && filteredFirms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                    {search ? "Aramanıza uyan firma bulunamadı." : "Henüz kayıtlı firma bulunmuyor."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sayfalama */}
      {!loading && filteredFirms.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Toplam {filteredFirms.length} firmadan {currentPage * PAGE_SIZE + 1}–
            {Math.min(filteredFirms.length, (currentPage + 1) * PAGE_SIZE)} arası gösteriliyor
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
