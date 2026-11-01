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
import { AlertDialog, Button, Card, Chip, Skeleton, Table, toast } from "@heroui/react";
import { CategoryBadge } from "@/components/category-badge";
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
        toast.danger(err instanceof Error ? err.message : "Çöp kutusu yüklenemedi.");
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
      toast.danger(err instanceof Error ? err.message : "Geri alınamadı.");
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
      toast.danger(err instanceof Error ? err.message : "Silinemedi.");
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
      toast.danger(err instanceof Error ? err.message : "Çöp kutusu boşaltılamadı.");
    } finally {
      setEmptying(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <Card.Header className="flex flex-row items-center justify-between gap-4 pb-4">
          <div className="space-y-1">
            <Card.Title className="text-base font-semibold">Son Silinen Fişler</Card.Title>
            <Card.Description>
              Silinen fişler 30 gün boyunca burada saklanır ve dilediğiniz zaman geri alabilirsiniz.
            </Card.Description>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onPress={() => {
                setLoading(true);
                fetchItems();
              }}
              isDisabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Yenile
            </Button>
            {items.length > 0 && (
              <Button
                type="button"
                variant="danger-soft"
                size="sm"
                onPress={() => setEmptyDialogOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Tümünü Temizle ({items.length})
              </Button>
            )}
          </div>
        </Card.Header>
        <Card.Content>
          {loading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Check className="size-8 text-muted/60 mb-2" />
              <p className="text-sm font-medium text-foreground">Çöp kutusu boş</p>
              <p className="text-xs text-muted mt-1">
                Silinen fişleriniz olduğunda burada görüntülenecektir.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table variant="secondary">
                <Table.ScrollContainer>
                  <Table.Content aria-label="Son silinen fişler" className="min-w-[620px]">
                    <Table.Header>
                      <Table.Column isRowHeader>Firma</Table.Column>
                      <Table.Column>Fiş Tarihi</Table.Column>
                      <Table.Column className="text-right">Tutar</Table.Column>
                      <Table.Column>Kategori</Table.Column>
                      <Table.Column>Silinme Zamanı</Table.Column>
                      <Table.Column>Kalan Süre</Table.Column>
                      <Table.Column className="text-right">İşlemler</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {items.map((item) => {
                        const days = trashDaysLeft(item.deleted_at);
                        const isActing = actingId === item.id;
                        return (
                          <Table.Row key={item.id} id={item.id}>
                            <Table.Cell className="font-medium text-foreground">
                              {item.receipt.firma_adi || "İsimsiz"}
                            </Table.Cell>
                            <Table.Cell className="tabular-nums text-muted text-xs">
                              {isoToTrDate(item.receipt.tarih)}
                            </Table.Cell>
                            <Table.Cell className="text-right font-medium tabular-nums">
                              {formatTL(item.receipt.toplam_tutar)}
                            </Table.Cell>
                            <Table.Cell>
                              <CategoryBadge category={item.receipt.kategori} size="sm" />
                            </Table.Cell>
                            <Table.Cell className="tabular-nums text-xs text-muted">
                              {isoToTrDate(item.deleted_at.slice(0, 10))}
                            </Table.Cell>
                            <Table.Cell>
                              <Chip size="sm"
                                color={days <= 1 ? "danger" : "default"}
                                variant={days <= 1 ? "soft" : "secondary"}
                                className="gap-1 text-xs"
                              >
                                <Clock className="size-3" />
                                {trashLeftLabel(days)}
                              </Chip>
                            </Table.Cell>
                            <Table.Cell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  isDisabled={isActing}
                                  onPress={() => handleRestore(item)}
                                  className="gap-1 text-xs h-7 px-2"
                                >
                                  {isActing ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <ArchiveRestore className="size-3 text-accent" />
                                  )}
                                  Geri Al
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  isDisabled={isActing}
                                  onPress={() => handlePurgeSingle(item)}
                                  className="gap-1 text-xs h-7 px-2 text-danger hover:bg-danger/10"
                                >
                                  Kalıcı Sil
                                </Button>
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Tümünü Boşalt Onay Dialogu */}
      <AlertDialog.Backdrop isOpen={emptyDialogOpen} onOpenChange={setEmptyDialogOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>Çöp Kutusunu Boşalt</AlertDialog.Heading>
              <p className="text-sm text-muted">
                Çöp kutusundaki {items.length} adet fiş ve varsa saklanan fotoğrafları kalıcı olarak
                silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
              </p>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary" size="sm" isDisabled={emptying}>İptal</Button>
              <Button size="sm"
                onPress={handleEmptyAll}
                isDisabled={emptying}
                className="bg-danger text-destructive-foreground hover:bg-danger/90"
              >
                {emptying ? "Siliniyor…" : "Tümünü Kalıcı Olarak Sil"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
