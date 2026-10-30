"use client";

import { formatTL, isoToTrDate } from "@shared/lib/format";
import {
  ArchiveRestore,
  Check,
  Clock,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  listTrash,
  purgeTrash,
  restoreFromTrash,
  trashDaysLeft,
  trashLeftLabel,
  type TrashItem,
} from "@/lib/trash";

export function TrashTab() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [emptying, setEmptying] = useState(false);

  const fetchItems = () => {
    void listTrash()
      .then((data) => setItems(data))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Çöp kutusu yüklenemedi.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleRestore = async (item: TrashItem) => {
    setActingId(item.id);
    try {
      await restoreFromTrash(item);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success(`"${item.receipt.firma_adi}" fişi başarıyla geri alındı.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Geri alınamadı.");
    } finally {
      setActingId(null);
    }
  };

  const handlePurgeSingle = async (item: TrashItem) => {
    setActingId(item.id);
    try {
      await purgeTrash([item]);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success(`"${item.receipt.firma_adi}" fişi kalıcı olarak silindi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi.");
    } finally {
      setActingId(null);
    }
  };

  const handleEmptyAll = async () => {
    if (!items.length) return;
    setEmptying(true);
    try {
      await purgeTrash(items);
      setItems([]);
      setEmptyDialogOpen(false);
      toast.success("Çöp kutusundaki tüm fişler kalıcı olarak silindi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Çöp kutusu boşaltılamadı.");
    } finally {
      setEmptying(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">Son Silinen Fişler</CardTitle>
            <CardDescription>
              Silinen fişler 30 gün boyunca burada saklanır ve dilediğiniz zaman geri alabilirsiniz.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                fetchItems();
              }}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Yenile
            </Button>
            {items.length > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setEmptyDialogOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Tümünü Temizle ({items.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Check className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">Çöp kutusu boş</p>
              <p className="text-xs text-muted-foreground mt-1">
                Silinen fişleriniz olduğunda burada görüntülenecektir.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firma</TableHead>
                    <TableHead>Fiş Tarihi</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Silinme Zamanı</TableHead>
                    <TableHead>Kalan Süre</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const days = trashDaysLeft(item.deleted_at);
                    const isActing = actingId === item.id;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-foreground">
                          {item.receipt.firma_adi || "İsimsiz"}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground text-xs">
                          {isoToTrDate(item.receipt.tarih)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatTL(item.receipt.toplam_tutar)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize text-xs">
                            {item.receipt.kategori}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums text-xs text-muted-foreground">
                          {isoToTrDate(item.deleted_at.slice(0, 10))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={days <= 1 ? "destructive" : "outline"}
                            className="gap-1 text-xs"
                          >
                            <Clock className="size-3" />
                            {trashLeftLabel(days)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isActing}
                              onClick={() => handleRestore(item)}
                              className="gap-1 text-xs h-7 px-2"
                            >
                              {isActing ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <ArchiveRestore className="size-3 text-primary" />
                              )}
                              Geri Al
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isActing}
                              onClick={() => handlePurgeSingle(item)}
                              className="gap-1 text-xs h-7 px-2 text-destructive hover:bg-destructive/10"
                            >
                              Kalıcı Sil
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tümünü Boşalt Onay Dialogu */}
      <AlertDialog open={emptyDialogOpen} onOpenChange={setEmptyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Çöp Kutusunu Boşalt</AlertDialogTitle>
            <AlertDialogDescription>
              Çöp kutusundaki {items.length} adet fiş ve varsa saklanan fotoğrafları kalıcı olarak
              silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={emptying}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyAll}
              disabled={emptying}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {emptying ? "Siliniyor…" : "Tümünü Kalıcı Olarak Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
