"use client";

import {
  AlertTriangle,
  Check,
  FileCode,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AlertDialog, Button, Card, Chip, Modal, Skeleton, Table, toast } from "@heroui/react";
import { clearErrors, listErrors, type AppErrorRecord } from "@/lib/errorLog";

export function ErrorLogTab() {
  const [errors, setErrors] = useState<AppErrorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<AppErrorRecord | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchErrors = () => {
    void listErrors()
      .then((data) => setErrors(data))
      .catch((err) => {
        toast.danger(err instanceof Error ? err.message : "Hata kayıtları yüklenemedi.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await clearErrors();
      setErrors([]);
      setClearDialogOpen(false);
      toast.success("Hata kayıtları temizlendi.");
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Temizlenemedi.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <Card.Header className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <Card.Title>Uygulama Hata Kayıtları</Card.Title>
            <Card.Description>
              Uygulama çalışırken karşılaşılan beklenmedik durumlar ve sistem kayıtları burada listelenir.
            </Card.Description>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onPress={() => {
                setLoading(true);
                fetchErrors();
              }}
              isDisabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Yenile
            </Button>
            {errors.length > 0 && (
              <Button
                type="button"
                variant="danger-soft"
                size="sm"
                onPress={() => setClearDialogOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Kayıtları Temizle ({errors.length})
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
          ) : errors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Check className="size-8 text-muted/60 mb-2" />
              <p className="text-sm font-medium text-foreground">Hata kaydı bulunmuyor</p>
              <p className="text-xs text-muted mt-1">
                Tüm servisler sorunsuz çalışıyor.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Hata kayıtları" className="min-w-[600px]">
                    <Table.Header>
                      <Table.Column isRowHeader>Tarih & Saat</Table.Column>
                      <Table.Column>Bağlam</Table.Column>
                      <Table.Column>Mesaj</Table.Column>
                      <Table.Column>Platform / Sürüm</Table.Column>
                      <Table.Column className="text-right">Detay</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {errors.map((err) => (
                        <Table.Row key={err.id} id={err.id}>
                          <Table.Cell className="tabular-nums text-xs text-muted whitespace-nowrap">
                            {err.created_at ? new Date(err.created_at).toLocaleString("tr-TR") : "—"}
                          </Table.Cell>
                          <Table.Cell>
                            <Chip size="sm" variant="secondary">
                              {err.context || "genel"}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="max-w-md truncate font-medium text-xs text-foreground">
                            {err.message}
                          </Table.Cell>
                          <Table.Cell className="text-xs text-muted whitespace-nowrap">
                            {[err.platform, err.app_version].filter(Boolean).join(" · ") || "—"}
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onPress={() => setSelectedError(err)}
                              className="gap-1"
                            >
                              <FileCode className="size-3" />
                              İncele
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Detay Dialogu */}
      <Modal.Backdrop isOpen={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
        <Modal.Container className="sm:w-full">
          <Modal.Dialog className="sm:max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                Hata Detayı
              </Modal.Heading>
              <p className="text-sm text-muted">
                Bağlam: <span className="font-semibold">{selectedError?.context}</span> · Tarih:{" "}
                {selectedError?.created_at ? new Date(selectedError.created_at).toLocaleString("tr-TR") : "—"}
              </p>
            </Modal.Header>

            {selectedError && (
              <div className="space-y-4 py-2">
                <div className="rounded-lg border bg-default/40 p-3 text-xs space-y-1">
                  <span className="font-semibold text-foreground">Hata Mesajı:</span>
                  <p className="text-danger break-words font-medium">{selectedError.message}</p>
                </div>

                {selectedError.detail ? (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted">Teknik Detay (Stack Trace):</span>
                    <pre className="max-h-60 overflow-x-auto rounded-lg border bg-default/60 p-3 text-xs tabular-nums text-foreground/90 whitespace-pre-wrap break-all">
                      {selectedError.detail}
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-muted">Ek teknik detay bulunmuyor.</p>
                )}
              </div>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Kayıtları Temizle Onayı */}
      <AlertDialog.Backdrop isOpen={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>Hata Kayıtlarını Temizle</AlertDialog.Heading>
              <p className="text-sm text-muted">
                {errors.length} adet hata kaydı kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
              </p>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary" size="sm" isDisabled={clearing}>İptal</Button>
              <Button size="sm"
                onPress={handleClearAll}
                isDisabled={clearing}
              >
                {clearing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Temizleniyor…
                  </>
                ) : (
                  "Kayıtları Temizle"
                )}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
