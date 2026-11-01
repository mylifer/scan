"use client";

import { formatTL } from "@shared/lib/format";
import type { CachedPdf } from "@shared/services/efatura/pdfCache";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Modal, Skeleton, toast } from "@heroui/react";
import { downloadFile } from "@/lib/download";
import { fetchPdf, type EFatura, type Yon } from "@/lib/efatura";

interface PdfViewerDialogProps {
  fatura: EFatura | null;
  yon: Yon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PdfViewerContent({
  fatura,
  yon,
  open,
  onOpenChange,
}: {
  fatura: EFatura;
  yon: Yon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<{
    cached: CachedPdf | null;
    loading: boolean;
    error: string | null;
  }>({
    cached: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    void fetchPdf(yon, fatura.ettn, fatura.tur)
      .then((res) => {
        if (!cancelled) setState({ cached: res, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "PDF yüklenemedi.";
          setState({ cached: null, loading: false, error: msg });
          toast.danger(msg);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fatura.ettn, fatura.tur, yon]);

  const handleDownload = () => {
    if (!state.cached) return;
    const docName = (fatura.belgeNo || fatura.ettn).replace(/[/\\?%*:|"<>]/g, "_");
    const filename = `${fatura.tarih}_${docName}.pdf`;
    downloadFile([state.cached.bytes as BlobPart], filename, "application/pdf");
    toast.success("PDF indirildi.");
  };

  const handleRetry = () => {
    setState({ cached: null, loading: true, error: null });
    void fetchPdf(yon, fatura.ettn, fatura.tur)
      .then((res) => setState({ cached: res, loading: false, error: null }))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "PDF yüklenemedi.";
        setState({ cached: null, loading: false, error: msg });
        toast.danger(msg);
      });
  };

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Container className="sm:w-full">
        <Modal.Dialog className="flex h-[88vh] sm:max-w-5xl flex-col p-4 sm:p-6 overflow-hidden">
          <Modal.CloseTrigger />
          <Modal.Header className="border-b pb-4 pr-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <Modal.Heading className="truncate text-base sm:text-lg font-semibold" title={fatura.unvan || "e-Fatura Önizleme"}>
                  {fatura.unvan || "e-Fatura Önizleme"}
                </Modal.Heading>
                <p className="text-sm text-muted break-all text-xs sm:text-sm text-muted">
                  {fatura.belgeNo || fatura.ettn} · {fatura.tarih} ·{" "}
                  <span className="font-semibold text-foreground whitespace-nowrap">
                    {`${formatTL(fatura.tutar)} ${fatura.paraBirimi}`}
                  </span>
                </p>
              </div>

              {state.cached && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onPress={handleDownload}
                  className="shrink-0 gap-1.5"
                >
                  <Download className="size-4" />
                  İndir
                </Button>
              )}
            </div>
          </Modal.Header>

          <div className="relative flex-1 min-h-0 overflow-hidden pt-2">
            {state.loading && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                <Loader2 className="size-8 animate-spin text-accent" />
                <p className="text-sm text-muted">PDF belgesi getiriliyor…</p>
                <Skeleton className="h-64 w-3/4 rounded-lg" />
              </div>
            )}

            {state.error && !state.loading && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
                <FileText className="size-12 text-muted/50" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-danger">PDF Yüklenemedi</p>
                  <p className="max-w-md text-xs text-muted">{state.error}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onPress={handleRetry} className="gap-1.5">
                  <RefreshCw className="size-3.5" />
                  Tekrar Dene
                </Button>
              </div>
            )}

            {state.cached && !state.loading && state.cached.blobUrl && (
              <iframe
                src={state.cached.blobUrl}
                className="h-full w-full rounded-md border bg-default/20"
                title="e-Fatura Önizleme"
              />
            )}

            {state.cached && !state.loading && !state.cached.blobUrl && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-4">
                <p className="text-sm text-muted">Önizleme oluşturulamadı, doğrudan indirebilirsiniz.</p>
                <Button size="sm" type="button" onPress={handleDownload} className="gap-1.5">
                  <Download className="size-4" />
                  PDF Dosyasını İndir
                </Button>
              </div>
            )}
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function PdfViewerDialog({ fatura, yon, open, onOpenChange }: PdfViewerDialogProps) {
  if (!open || !fatura) return null;
  return (
    <PdfViewerContent
      key={fatura.ettn || fatura.belgeNo}
      fatura={fatura}
      yon={yon}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
