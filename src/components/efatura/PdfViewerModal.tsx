import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '../../lib/errors';
import { haptics } from '../../lib/haptics';
import { useWide } from '../../lib/layout';
import { fontFamily, tabular, useShadcnTheme, useTheme } from '../../lib/theme';
import type { EFatura, Yon } from '../../services/efatura/qnbEfatura';
import { type CachedPdf, fetchInvoicePdf, getCachedPdf } from '../../services/efatura/pdfCache';
import { sharePdf } from '../../services/export/exportReceipts';
import { Icon } from '../ui/Icon';
import { Badge } from '../web/Badge';

interface Props {
  visible: boolean;
  fatura: EFatura | null;
  yon: Yon;
  onClose: () => void;
}

function para(value: number | undefined, currency: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/**
 * e-Fatura PDF Pop-up / Önizleme Modalı.
 * Web'de iframe ile gömülü PDF görüntüleyici açar; indirme beklemeden önbellekten anında gösterir.
 */
export function PdfViewerModal({ visible, fatura, yon, onClose }: Props) {
  if (!visible || !fatura) return null;
  return <PdfViewerDialog key={fatura.ettn || fatura.belgeNo} fatura={fatura} yon={yon} onClose={onClose} />;
}

function PdfViewerDialog({ fatura, yon, onClose }: { fatura: EFatura; yon: Yon; onClose: () => void }) {
  const theme = useTheme();
  const st = useShadcnTheme();
  const wide = useWide();

  const initialCached = fatura.ettn ? getCachedPdf(yon, fatura.ettn, fatura.tur) : undefined;
  const [cached, setCached] = useState<CachedPdf | null>(initialCached ?? null);
  const [loading, setLoading] = useState(!initialCached);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Web'de Escape tuşuna basınca pencereyi kapat
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Önbellekte yoksa arka plandan getir
  useEffect(() => {
    if (cached || !fatura.ettn) return;

    let active = true;
    fetchInvoicePdf(yon, fatura.ettn, fatura.tur)
      .then((res) => {
        if (!active) return;
        setCached(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(errorMessage(err));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cached, fatura.ettn, fatura.tur, yon]);

  const retry = () => {
    if (!fatura.ettn) return;
    setLoading(true);
    setError(null);
    fetchInvoicePdf(yon, fatura.ettn, fatura.tur)
      .then((res) => {
        setCached(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(errorMessage(err));
        setLoading(false);
      });
  };

  const handleDownload = async () => {
    if (!cached) return;
    setDownloading(true);
    try {
      const ad = (fatura.belgeNo || fatura.ettn).replace(/[^\w-]/g, '_');
      await sharePdf(cached.bytes, `${ad}.pdf`);
      haptics.success();
    } catch {
      // Hata oluşursa sessizce geç
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} accessibilityLabel="Pencereyi kapat" />

        <View
          style={[
            styles.dialog,
            wide ? styles.dialogWide : styles.dialogNarrow,
            {
              backgroundColor: st.card,
              borderColor: st.border,
            },
          ]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: st.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconBox, { backgroundColor: st.muted, borderColor: st.border }]}>
                <Icon sf="doc.text.fill" ion="document-text" size={18} color={theme.blue} />
              </View>
              <View style={styles.meta}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: st.cardForeground }]} numberOfLines={1}>
                    {fatura.unvan}
                  </Text>
                  {fatura.tur === 'earsiv' && <Badge variant="outline">e-Arşiv</Badge>}
                  {fatura.tip === 'IADE' && <Badge variant="destructive">İade</Badge>}
                  {fatura.iptal && <Badge variant="secondary">İptal</Badge>}
                </View>
                <Text style={[styles.subtitle, tabular, { color: st.mutedForeground }]} numberOfLines={1}>
                  {fatura.belgeNo || 'Belge no yok'} · {fatura.tarih} · {para(fatura.tutar, fatura.paraBirimi)}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              {cached && (
                <Pressable
                  onPress={handleDownload}
                  disabled={downloading}
                  accessibilityRole="button"
                  accessibilityLabel="PDF'i İndir"
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.actionBtn,
                    {
                      backgroundColor: st.secondary,
                      borderColor: st.border,
                    },
                    (hovered || pressed) && { backgroundColor: st.muted },
                  ]}>
                  {downloading ? (
                    <ActivityIndicator size="small" color={st.cardForeground} />
                  ) : (
                    <>
                      <Icon sf="arrow.down.doc" ion="download-outline" size={14} color={st.cardForeground} />
                      <Text style={[styles.actionBtnText, { color: st.cardForeground }]}>İndir</Text>
                    </>
                  )}
                </Pressable>
              )}

              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.closeBtn,
                  {
                    backgroundColor: st.muted,
                    borderColor: st.border,
                  },
                  (hovered || pressed) && { opacity: 0.7 },
                ]}>
                <Icon sf="xmark" ion="close" size={16} color={st.cardForeground} weight="semibold" />
              </Pressable>
            </View>
          </View>

          {/* Content Body */}
          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.blue} />
                <Text style={[styles.loadingText, { color: st.mutedForeground }]}>
                  Fatura PDF&apos;i QNB eSolutions&apos;tan getiriliyor…
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Icon sf="exclamationmark.triangle.fill" ion="warning-outline" size={32} color={theme.orange} />
                <Text style={[styles.errorTitle, { color: st.cardForeground }]}>PDF Yüklenemedi</Text>
                <Text style={[styles.errorDesc, { color: st.mutedForeground }]}>{error}</Text>
                <Pressable
                  onPress={retry}
                  style={[styles.retryBtn, { backgroundColor: st.primary }]}>
                  <Text style={[styles.retryBtnText, { color: st.primaryForeground }]}>Tekrar Dene</Text>
                </Pressable>
              </View>
            ) : cached?.blobUrl && Platform.OS === 'web' ? (
              <View style={styles.iframeContainer}>
                {/* Web tarayıcısının yerleşik PDF okuyucusu */}
                <iframe
                  src={cached.blobUrl}
                  title={`${fatura.unvan} - ${fatura.belgeNo}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    borderRadius: 4,
                  }}
                />
              </View>
            ) : (
              <View style={styles.fallbackBox}>
                <Icon sf="doc.text.fill" ion="document" size={48} color={theme.blue} />
                <Text style={[styles.fallbackTitle, { color: st.cardForeground }]}>
                  {fatura.belgeNo || 'Fatura PDF'}
                </Text>
                <Text style={[styles.fallbackDesc, { color: st.mutedForeground }]}>
                  {para(fatura.tutar, fatura.paraBirimi)} tutarındaki fatura hazır.
                </Text>
                <Pressable
                  onPress={handleDownload}
                  style={[styles.retryBtn, { backgroundColor: st.primary }]}>
                  <Text style={[styles.retryBtnText, { color: st.primaryForeground }]}>Dosyayı Aç / Paylaş</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  dialog: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  dialogWide: {
    width: '92%',
    maxWidth: 960,
    height: '90%',
    maxHeight: 880,
  },
  dialogNarrow: {
    width: '100%',
    height: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily,
    fontSize: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionBtnText: {
    fontFamily,
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  iframeContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontFamily,
    fontSize: 13,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 32,
  },
  errorTitle: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600',
  },
  errorDesc: {
    fontFamily,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
  },
  fallbackBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  fallbackTitle: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackDesc: {
    fontFamily,
    fontSize: 13,
    textAlign: 'center',
  },
});
