"use client";

import { formatTL } from "@shared/lib/format";
import { olaganDisi, type DonemOzet, type OlaganDisi } from "@shared/lib/efaturaOzet";
import { AlertCircle, FileSpreadsheet } from "lucide-react";
import { useMemo } from "react";
import { donemOzetiHesapla, gecerliFaturalar, tutarSatiri } from "@/lib/donemOzet";
import { exportExcel, type EFatura, type Yon } from "@/lib/efatura";
import { Button, Card, Chip, Modal, Table } from "@heroui/react";

interface DonemOzetDialogProps {
  faturalar: EFatura[];
  periodLabel: string;
  yon: Yon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DonemOzetDialog({
  faturalar,
  periodLabel,
  yon,
  open,
  onOpenChange,
}: DonemOzetDialogProps) {
  const ozet = useMemo<DonemOzet>(() => donemOzetiHesapla(faturalar, yon), [faturalar, yon]);

  const olaganDisiList = useMemo<OlaganDisi[]>(() => {
    return olaganDisi(gecerliFaturalar(faturalar).map(tutarSatiri), 5);
  }, [faturalar]);

  const handleExport = () => {
    exportExcel(faturalar, periodLabel, yon);
  };

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Container className="sm:w-full">
        <Modal.Dialog className="flex max-h-[90vh] sm:max-w-4xl flex-col overflow-hidden">
          <Modal.CloseTrigger />
          <Modal.Header>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <Modal.Heading className="break-words sm:text-lg">
                  {periodLabel} · Dönem Özeti ({yon === "gelen" ? "Gelen e-Faturalar" : "Giden e-Faturalar"})
                </Modal.Heading>
                <p className="text-sm text-muted text-xs sm:text-sm text-muted">
                  Bu dönemdeki faturaların matrah ve vergi toplamları
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onPress={handleExport}
                className="shrink-0 gap-1.5"
              >
                <FileSpreadsheet className="size-4" />
                Excel İndir
              </Button>
            </div>
          </Modal.Header>

          <div className="flex-1 min-h-0 space-y-6 overflow-y-auto pr-1 pt-2">
            {/* Özet Kartları */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SummaryBlock
                title="KDV Hariç Matrah"
                tutar={yon === "gelen" ? ozet.gelen.matrah : ozet.satis.matrah + ozet.earsiv.matrah}
                sub={`${yon === "gelen" ? ozet.gelen.adet : ozet.satis.adet + ozet.earsiv.adet} adet fatura`}
              />
              <SummaryBlock
                title="Toplam KDV"
                tutar={yon === "gelen" ? ozet.gelen.kdv : ozet.satis.kdv + ozet.earsiv.kdv}
                sub={yon === "gelen" ? "İndirilecek KDV" : "Hesaplanan KDV"}
              />
              <SummaryBlock
                title="Genel Toplam (Ödenecek)"
                tutar={yon === "gelen" ? ozet.gelen.tutar : ozet.satis.tutar + ozet.earsiv.tutar}
                sub="KDV dahil"
                highlight
              />
            </div>

            {/* Giden Fatura Tipleri Ayrımı */}
            {yon === "giden" && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted">Fatura Dağılımı</h4>
                <div className="w-full overflow-x-auto rounded-lg border">
                  <Table>
                    <Table.ScrollContainer>
                      <Table.Content aria-label="Dönem özeti" className="min-w-[520px]">
                        <Table.Header>
                          <Table.Column isRowHeader>Fatura Türü</Table.Column>
                          <Table.Column className="text-right">Adet</Table.Column>
                          <Table.Column className="text-right">Matrah</Table.Column>
                          <Table.Column className="text-right">KDV</Table.Column>
                          <Table.Column className="text-right">Toplam Tutar</Table.Column>
                        </Table.Header>
                        <Table.Body>
                          <Table.Row>
                            <Table.Cell className="font-medium">e-Fatura Satış</Table.Cell>
                            <Table.Cell className="text-right whitespace-nowrap tabular-nums">{ozet.satis.adet}</Table.Cell>
                            <Table.Cell className="text-right whitespace-nowrap tabular-nums">{formatTL(ozet.satis.matrah)}</Table.Cell>
                            <Table.Cell className="text-right whitespace-nowrap tabular-nums">{formatTL(ozet.satis.kdv)}</Table.Cell>
                            <Table.Cell className="text-right font-medium whitespace-nowrap tabular-nums">{formatTL(ozet.satis.tutar)}</Table.Cell>
                          </Table.Row>
                          {ozet.iade.adet > 0 && (
                            <Table.Row>
                              <Table.Cell className="font-medium">İadeler</Table.Cell>
                              <Table.Cell className="text-right whitespace-nowrap tabular-nums">{ozet.iade.adet}</Table.Cell>
                              <Table.Cell className="text-right whitespace-nowrap tabular-nums">-{formatTL(ozet.iade.matrah)}</Table.Cell>
                              <Table.Cell className="text-right whitespace-nowrap tabular-nums">-{formatTL(ozet.iade.kdv)}</Table.Cell>
                              <Table.Cell className="text-right font-medium whitespace-nowrap tabular-nums">-{formatTL(ozet.iade.tutar)}</Table.Cell>
                            </Table.Row>
                          )}
                          {ozet.earsiv.adet > 0 && (
                            <Table.Row>
                              <Table.Cell className="font-medium">e-Arşiv Fatura</Table.Cell>
                              <Table.Cell className="text-right whitespace-nowrap tabular-nums">{ozet.earsiv.adet}</Table.Cell>
                              <Table.Cell className="text-right whitespace-nowrap tabular-nums">{formatTL(ozet.earsiv.matrah)}</Table.Cell>
                              <Table.Cell className="text-right whitespace-nowrap tabular-nums">{formatTL(ozet.earsiv.kdv)}</Table.Cell>
                              <Table.Cell className="text-right font-medium whitespace-nowrap tabular-nums">{formatTL(ozet.earsiv.tutar)}</Table.Cell>
                            </Table.Row>
                          )}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                </div>
              </div>
            )}

            {/* Olağan Dışı Yüksek Tutarlı Faturalar */}
            {olaganDisiList.length > 0 && (
              <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                  <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  Olağan Dışı Yüksek Tutarlı Faturalar
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Aşağıdaki faturaların matrahı bu dönemdeki faturaların ortanca matrahının 5 katından yüksektir:
                </p>
                <div className="space-y-1.5">
                  {olaganDisiList.map((od) => (
                    <div
                      key={od.ettn}
                      className="flex flex-wrap items-center justify-between rounded border bg-surface p-2 text-xs"
                    >
                      <div>
                        <span className="font-medium">{od.belgeNo || od.ettn}</span> · {od.tarih}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{formatTL(od.matrah)}</span>
                        <Chip size="sm" variant="secondary">
                          {od.kat}× ortalama
                        </Chip>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function SummaryBlock({
  title,
  tutar,
  sub,
  highlight,
}: {
  title: string;
  tutar: number;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-accent/40 dark:border-accent/40 bg-accent/5" : ""}>
      <Card.Header>
        <p className="text-xs text-muted">{title}</p>
        <Card.Title className="text-xl tabular-nums">{formatTL(tutar)}</Card.Title>
        <p className="text-xs text-muted">{sub}</p>
      </Card.Header>
    </Card>
  );
}
