"use client";

import { formatTL } from "@shared/lib/format";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Chip, Modal, Skeleton, Table, toast } from "@heroui/react";
import { fetchDetay, type EFatura, type FaturaDetay, type Yon } from "@/lib/efatura";

interface FaturaDetayDialogProps {
  fatura: EFatura | null;
  yon: Yon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPdf?: (fatura: EFatura) => void;
  onDetayLoaded?: (ettn: string, detay: FaturaDetay) => void;
}

function FaturaDetayContent({
  fatura,
  yon,
  open,
  onOpenChange,
  onOpenPdf,
  onDetayLoaded,
}: {
  fatura: EFatura;
  yon: Yon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPdf?: (fatura: EFatura) => void;
  onDetayLoaded?: (ettn: string, detay: FaturaDetay) => void;
}) {
  const [state, setState] = useState<{
    detay: FaturaDetay | null;
    loading: boolean;
    error: string | null;
  }>({
    detay: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    void fetchDetay(yon, fatura.ettn, fatura.tur)
      .then((res) => {
        if (!cancelled) {
          setState({ detay: res, loading: false, error: null });
          onDetayLoaded?.(fatura.ettn, res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Fatura detayları getirilemedi.";
          setState({ detay: null, loading: false, error: msg });
          toast.danger(msg);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fatura.ettn, fatura.tur, yon, onDetayLoaded]);

  const handleRetry = () => {
    setState({ detay: null, loading: true, error: null });
    void fetchDetay(yon, fatura.ettn, fatura.tur)
      .then((res) => setState({ detay: res, loading: false, error: null }))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Fatura detayları getirilemedi.";
        setState({ detay: null, loading: false, error: msg });
        toast.danger(msg);
      });
  };

  const currency = state.detay?.paraBirimi || fatura.paraBirimi || "TRY";

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Container className="sm:w-full">
        <Modal.Dialog className="flex max-h-[92vh] sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl flex-col overflow-hidden">
          <Modal.CloseTrigger />
          <Modal.Header>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Modal.Heading className="truncate sm:text-lg" title={fatura.belgeNo || fatura.ettn}>
                    Fatura Detayı · {fatura.belgeNo || fatura.ettn}
                  </Modal.Heading>
                  {state.detay?.tip && <Chip size="sm" variant="soft">{state.detay.tip}</Chip>}
                </div>
                <p className="text-sm text-muted break-all text-xs sm:text-sm text-muted">
                  Tarih: {state.detay?.tarih || fatura.tarih} · ETTN: <span className="tabular-nums text-xs">{fatura.ettn}</span>
                </p>
              </div>

              {onOpenPdf && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onPress={() => onOpenPdf(fatura)}
                  className="shrink-0 gap-1.5"
                >
                  <FileText className="size-4" />
                  <span>PDF Görüntüle</span>
                </Button>
              )}
            </div>
          </Modal.Header>

          <div className="flex-1 min-h-0 space-y-6 overflow-y-auto pr-1 pt-2">
            {state.loading && (
              <div className="space-y-4 py-8">
                <div className="flex items-center justify-center gap-2 text-sm text-muted">
                  <Loader2 className="size-5 animate-spin text-accent" />
                  UBL faturası çözümleniyor…
                </div>
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-48 w-full rounded-lg" />
              </div>
            )}

            {state.error && !state.loading && (
              <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-danger">Detaylar Yüklenemedi</p>
                  <p className="max-w-md text-xs text-muted">{state.error}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onPress={handleRetry} className="gap-1.5">
                  <RefreshCw className="size-3.5" />
                  Tekrar Dene
                </Button>
              </div>
            )}

            {state.detay && !state.loading && (
              <>
                {/* Taraflar Kartları */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Card>
                    <Card.Header>
                      <Card.Title className="uppercase text-muted">
                        Satıcı (Gönderen)
                      </Card.Title>
                    </Card.Header>
                    <Card.Content className="min-w-0 space-y-1 text-sm">
                      <p className="font-medium text-foreground break-words">{state.detay.saticiUnvan || "—"}</p>
                      <p className="text-xs text-muted break-all">
                        VKN/TCKN: <span className="tabular-nums text-foreground">{state.detay.saticiVkn || "—"}</span>
                      </p>
                    </Card.Content>
                  </Card>

                  <Card>
                    <Card.Header>
                      <Card.Title className="uppercase text-muted">
                        Alıcı (Müşteri)
                      </Card.Title>
                    </Card.Header>
                    <Card.Content className="min-w-0 space-y-1 text-sm">
                      <p className="font-medium text-foreground break-words">{state.detay.aliciUnvan || "—"}</p>
                      <p className="text-xs text-muted break-all">
                        VKN/TCKN: <span className="tabular-nums text-foreground">{state.detay.aliciVkn || "—"}</span>
                      </p>
                    </Card.Content>
                  </Card>
                </div>

                {/* Kalemler Tablosu */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-muted">Fatura Kalemleri</h4>
                  <div className="w-full overflow-x-auto rounded-lg border">
                    <Table>
                      <Table.ScrollContainer>
                        <Table.Content aria-label="Fatura kalemleri" className="w-full min-w-[720px]">
                          <Table.Header>
                            <Table.Column isRowHeader className="w-12">#</Table.Column>
                            <Table.Column className="min-w-48">Mal / Hizmet</Table.Column>
                            <Table.Column className="w-28 text-right">Miktar</Table.Column>
                            <Table.Column className="w-32 text-right">Birim Fiyat</Table.Column>
                            <Table.Column className="w-20 text-right">KDV %</Table.Column>
                            <Table.Column className="w-32 text-right">KDV Tutarı</Table.Column>
                            <Table.Column className="w-36 text-right">Tutar (KDV Hariç)</Table.Column>
                          </Table.Header>
                          <Table.Body>
                            {state.detay.kalemler.map((k, idx) => (
                              <Table.Row key={idx} id={idx}>
                                <Table.Cell className="text-xs text-muted">{idx + 1}</Table.Cell>
                                <Table.Cell className="font-medium min-w-48 break-words">{k.ad}</Table.Cell>
                                <Table.Cell className="text-right whitespace-nowrap tabular-nums">
                                  {k.miktar} {k.birim}
                                </Table.Cell>
                                <Table.Cell className="text-right whitespace-nowrap tabular-nums">
                                  {formatTL(k.birimFiyat)} {currency}
                                </Table.Cell>
                                <Table.Cell className="text-right whitespace-nowrap tabular-nums">%{k.kdvOrani}</Table.Cell>
                                <Table.Cell className="text-right whitespace-nowrap tabular-nums">
                                  {formatTL(k.kdvTutari)} {currency}
                                </Table.Cell>
                                <Table.Cell className="text-right font-medium whitespace-nowrap tabular-nums">
                                  {formatTL(k.tutar)} {currency}
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Content>
                      </Table.ScrollContainer>
                    </Table>
                  </div>
                </div>

                {/* KDV Dağılımı ve Alt Toplamlar */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* KDV Dağılım Tablosu */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted">KDV Dağılımı</h4>
                    <div className="w-full overflow-x-auto rounded-lg border">
                      <Table>
                        <Table.ScrollContainer>
                          <Table.Content aria-label="Fatura kalemleri (2)" className="min-w-[280px]">
                            <Table.Header>
                              <Table.Column isRowHeader>Oran</Table.Column>
                              <Table.Column className="text-right">Matrah</Table.Column>
                              <Table.Column className="text-right">KDV</Table.Column>
                            </Table.Header>
                            <Table.Body>
                              {state.detay.kdvler.map((kd, idx) => (
                                <Table.Row key={idx} id={idx}>
                                  <Table.Cell className="font-medium">%{kd.oran}</Table.Cell>
                                  <Table.Cell className="text-right whitespace-nowrap tabular-nums">
                                    {formatTL(kd.matrah)} {currency}
                                  </Table.Cell>
                                  <Table.Cell className="text-right whitespace-nowrap tabular-nums">
                                    {formatTL(kd.tutar)} {currency}
                                  </Table.Cell>
                                </Table.Row>
                              ))}
                            </Table.Body>
                          </Table.Content>
                        </Table.ScrollContainer>
                      </Table>
                    </div>
                  </div>

                  {/* Toplam Özeti Kartı */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted">Tutar Özeti</h4>
                    <div className="space-y-2 rounded-lg border bg-default/30 p-4 text-sm font-sans">
                      <div className="flex justify-between">
                        <span className="text-muted">Ara Toplam (KDV Hariç):</span>
                        <span className="font-medium whitespace-nowrap tabular-nums text-foreground">
                          {formatTL(state.detay.araToplam)} {currency}
                        </span>
                      </div>
                      {state.detay.iskonto > 0 && (
                        <div className="flex justify-between text-danger">
                          <span>İskonto:</span>
                          <span className="font-medium whitespace-nowrap tabular-nums">
                            -{formatTL(state.detay.iskonto)} {currency}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted">Toplam KDV:</span>
                        <span className="font-medium whitespace-nowrap tabular-nums text-foreground">
                          {formatTL(state.detay.kdvToplam)} {currency}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-base font-semibold">
                        <span>Ödenecek Toplam:</span>
                        <span className="whitespace-nowrap tabular-nums text-accent font-bold">
                          {formatTL(state.detay.odenecek)} {currency}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Varsa Notlar */}
                {state.detay.notlar && state.detay.notlar.length > 0 && (
                  <div className="space-y-1.5 rounded-lg border bg-default/20 p-3 text-xs">
                    <span className="font-semibold text-muted">Fatura Notları:</span>
                    <ul className="list-inside list-disc space-y-0.5 text-muted">
                      {state.detay.notlar.map((not, i) => (
                        <li key={i}>{not}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function FaturaDetayDialog({
  fatura,
  yon,
  open,
  onOpenChange,
  onOpenPdf,
  onDetayLoaded,
}: FaturaDetayDialogProps) {
  if (!open || !fatura) return null;
  return (
    <FaturaDetayContent
      key={fatura.ettn || fatura.belgeNo}
      fatura={fatura}
      yon={yon}
      open={open}
      onOpenChange={onOpenChange}
      onOpenPdf={onOpenPdf}
      onDetayLoaded={onDetayLoaded}
    />
  );
}
