"use client";

import { isoToTrDate } from "@shared/lib/format";
import {
  AlertCircle,
  Archive,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  FileArchive,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button, Card, Chip, Modal, toast } from "@heroui/react";
import {
  executeRestore,
  exportFullBackup,
  previewRestoreZip,
  type BackupExportProgress,
  type RestorePlanPreview,
  type RestoreProgress,
} from "@/lib/backup";

export function BackupTab() {
  // Dışa aktarma durumu
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<BackupExportProgress | null>(null);

  // İçe aktarma durumu
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<RestorePlanPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Aktarma işlemi
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportProgress({ done: 0, total: 1, status: "Başlatılıyor…" });
    try {
      const res = await exportFullBackup((p) => setExportProgress(p));
      toast.success(
        `Yedek hazırlandı: ${res.receiptsCount} fiş ve ${res.photosCount} fotoğraf arşivlendi.`
      );
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Yedek alınamadı.");
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so user can choose again
    e.target.value = "";

    setAnalyzing(true);
    try {
      const p = await previewRestoreZip(file);
      setPreview(p);
      setPreviewOpen(true);
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Yedek dosyası açılamadı.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStartRestore = async () => {
    if (!preview) return;
    setRestoring(true);
    try {
      const res = await executeRestore(preview, (p) => setRestoreProgress(p));
      toast.success(
        `Geri yükleme tamamlandı: ${res.inserted} fiş aktarıldı, ${preview.skipped} mevcut fiş atlandı.`
      );
      setPreviewOpen(false);
      setPreview(null);
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Geri yükleme başarısız.");
    } finally {
      setRestoring(false);
      setRestoreProgress(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Yedek Al */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Archive className="size-5 text-accent" />
            <Card.Title>Tam Yedek Al (.zip)</Card.Title>
          </div>
          <Card.Description>
            Tüm fiş kayıtlarınız, KDV verileri, etiketler ve fiş fotoğrafları tek bir ZIP arşivinde
            toplanıp cihazınıza indirilir.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="rounded-lg border bg-default/40 p-3 text-xs text-muted space-y-1">
            <p className="font-medium text-foreground">Yedek Dosyası İçeriği:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>yedek.json (tüm fiş kayıtları ve manifest bilgisi)</li>
              <li>fotograflar/ (bulutta saklanan fiş görselleri)</li>
            </ul>
          </div>

          {exporting && exportProgress && (
            <div className="space-y-1.5 rounded-lg border bg-surface p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{exportProgress.status}</span>
                <span className="tabular-nums text-muted">
                  {exportProgress.done} / {exportProgress.total}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-default">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{
                    width: `${
                      exportProgress.total > 0
                        ? Math.min(100, (exportProgress.done / exportProgress.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          <Button size="sm"
            type="button"
            className="w-full gap-2"
            isDisabled={exporting}
            onPress={handleExport}
          >
            {exporting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Yedek Paketleniyor…
              </>
            ) : (
              <>
                <Download className="size-4" />
                Yedek İndir (.zip)
              </>
            )}
          </Button>
        </Card.Content>
      </Card>

      {/* Yedekten Geri Yükle */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <UploadCloud className="size-5 text-accent" />
            <Card.Title>Yedekten Geri Yükle</Card.Title>
          </div>
          <Card.Description>
            Daha önce aldığınız bir `.zip` yedeğini yükleyerek fişlerinizi ve fotoğraflarınızı
            hesabınıza aktarın.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            accept=".zip"
            className="hidden"
            onChange={handleFileChange}
          />

          <div
            onClick={() => !analyzing && fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors hover:bg-default/30"
          >
            {analyzing ? (
              <>
                <Loader2 className="size-8 animate-spin text-accent mb-2" />
                <p className="text-sm font-medium">Yedek dosyası inceleniyor…</p>
              </>
            ) : (
              <>
                <FileArchive className="size-8 text-muted/60 mb-2" />
                <p className="text-sm font-medium text-foreground">
                  Yedek Dosyasını Seçin (.zip)
                </p>
                <p className="text-xs text-muted mt-1">
                  Bilgisayarınızdaki fiş yedeğini buraya tıklayarak yükleyin.
                </p>
              </>
            )}
          </div>

          <div className="rounded-lg border bg-default/40 p-3 text-xs text-muted">
            <p className="flex items-center gap-1 font-medium text-foreground">
              <CheckCircle2 className="size-3.5 text-accent inline" />
              Akıllı Çift Kayıt Önleme
            </p>
            <p className="mt-1">
              Hesabınızda zaten kayıtlı olan fişler otomatik olarak tespit edilir ve tekrar eklenmez.
            </p>
          </div>
        </Card.Content>
      </Card>

      {/* İnceleme ve Onay Dialogu */}
      <Modal.Backdrop isOpen={previewOpen} onOpenChange={setPreviewOpen}>
        <Modal.Container className="sm:w-full">
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <ArrowUpCircle className="size-5 text-accent" />
                Yedek Geri Yükleme Önizlemesi
              </Modal.Heading>
              <p className="text-sm text-muted">
                Yedek dosyasındaki kayıtlar incelendi. Aşağıdaki özeti onayladıktan sonra aktarım
                başlayacaktır.
              </p>
            </Modal.Header>

            {preview && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border bg-surface p-3 space-y-1">
                    <span className="text-xs text-muted">Yedek Tarihi</span>
                    <p className="font-semibold text-foreground">
                      {isoToTrDate(preview.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-surface p-3 space-y-1">
                    <span className="text-xs text-muted">Yedeklenen Uygulama</span>
                    <p className="font-semibold text-foreground">{preview.manifest.appVersion}</p>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border bg-default/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Toplam Fiş Kaydı:</span>
                    <span className="font-semibold">{preview.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Yeni Eklenecek:</span>
                    <Chip size="sm" color="accent" variant="primary">{preview.toInsert.length} Fiş</Chip>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Zaten Mevcut (Atlanacak):</span>
                    <Chip size="sm" variant="secondary">{preview.skipped} Fiş</Chip>
                  </div>
                </div>

                {preview.toInsert.length === 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <p>
                      Bu yedekteki tüm fişler hesabınızda zaten mevcut olduğu için yeni fiş
                      eklenmeyecektir.
                    </p>
                  </div>
                )}

                {restoring && restoreProgress && (
                  <div className="space-y-1.5 rounded-lg border bg-surface p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{restoreProgress.status}</span>
                      <span className="tabular-nums text-muted">
                        {restoreProgress.done} / {restoreProgress.total}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-default">
                      <div
                        className="h-full bg-accent transition-all duration-300"
                        style={{
                          width: `${
                            restoreProgress.total > 0
                              ? Math.min(100, (restoreProgress.done / restoreProgress.total) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <Modal.Footer>
              <Button size="sm"
                type="button"
                variant="outline"
                isDisabled={restoring}
                onPress={() => setPreviewOpen(false)}
              >
                Vazgeç
              </Button>
              <Button size="sm"
                type="button"
                isDisabled={restoring || !preview?.toInsert.length}
                onPress={handleStartRestore}
                className="gap-2"
              >
                {restoring ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Aktarılıyor…
                  </>
                ) : (
                  `Aktarımı Başlat (${preview?.toInsert.length ?? 0} Fiş)`
                )}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
