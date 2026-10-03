import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { HeaderTextButton } from '../components/ui/HeaderButton';
import { ListRow, ListSection } from '../components/ui/List';
import { useAuth } from '../hooks/useAuth';
import { confirmDestructive, showActionSheet } from '../lib/actionSheet';
import { showAlert } from '../lib/alert';
import { errorMessage } from '../lib/errors';
import { formatBytes, formatTL } from '../lib/format';
import { haptics } from '../lib/haptics';
import { tabular, type as t, useTheme } from '../lib/theme';
import { VERSION_LABEL } from '../lib/version';
import { useMonthlyBudget } from '../lib/budget';
import { showToast } from '../lib/toast';
import { disableReminder, enableReminder, isReminderEnabled, remindersSupported } from '../services/reminders/taxReminders';
import { applyRestore, createBackup, previewRestore } from '../services/backup/backup';
import { pickBackupFile } from '../services/backup/pickBackupFile';
import { buildReceiptsWorkbook, exportFilename, shareXlsx, shareZipStream } from '../services/export/exportReceipts';
import { backupFilename } from '../lib/backupFormat';
import { clearCache } from '../lib/offlineCache';
import { supabase } from '../services/supabase/client';
import { countReceipts, getStorageUsage, getSummary, type StorageUsage } from '../services/supabase/receiptsRepository';
import { getVisionService } from '../services/vision';

/** Supabase free plan depolama kotası */
const STORAGE_QUOTA = 1024 * 1024 * 1024;
const REPO_URL = 'https://github.com/mylifer/scan';

export default function SettingsScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [exporting, setExporting] = useState(false);
  const email = session?.user.email ?? '';
  const vision = safeVision();
  const budget = useMonthlyBudget();
  const [reminder, setReminder] = useState(false);

  useEffect(() => {
    if (remindersSupported) isReminderEnabled().then(setReminder);
  }, []);

  async function toggleReminder(on: boolean) {
    setReminder(on);
    try {
      if (on) {
        if (!(await enableReminder())) {
          setReminder(false);
          showAlert('Bildirim izni gerekli', 'Hatırlatıcı için Ayarlar → Bildirimler bölümünden bu uygulamaya (Expo Go) izin verin.');
          return;
        }
        haptics.success();
        showToast('Vergi son günleri hatırlatılacak');
      } else {
        await disableReminder();
      }
    } catch (e) {
      setReminder(!on);
      showAlert('Hatırlatıcı ayarlanamadı', errorMessage(e));
    }
  }

  useEffect(() => {
    countReceipts().then(setCount).catch(() => setCount(null));
    getStorageUsage().then(setUsage).catch(() => setUsage(null));
  }, []);

  async function exportAll() {
    setExporting(true);
    try {
      await shareXlsx(buildReceiptsWorkbook(await getSummary(), 'Tüm Zamanlar'), exportFilename());
      haptics.success();
    } catch (e) {
      showAlert('Dışa aktarılamadı', errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  /** Yedekleme / geri yükleme sürerken satırda gösterilen ilerleme */
  const [backupStatus, setBackupStatus] = useState<{ kind: 'backup' | 'restore'; text: string } | null>(null);

  async function backup() {
    setBackupStatus({ kind: 'backup', text: 'Hazırlanıyor' });
    try {
      const r = await shareZipStream(backupFilename(), (sink) =>
        createBackup(sink, (done, total) => setBackupStatus({ kind: 'backup', text: total ? `Fotoğraflar ${done}/${total}` : 'Hazırlanıyor' })),
      );
      haptics.success();
      if (r.failedPhotos) {
        showAlert('Yedek oluşturuldu', `${r.receipts} fiş yedeklendi. ${r.failedPhotos} fotoğraf indirilemedi; bu fişler fotoğrafsız yedeklendi.`);
      } else {
        showToast(`${r.receipts} fiş ve ${r.photos} fotoğraf yedeklendi`);
      }
    } catch (e) {
      showAlert('Yedeklenemedi', errorMessage(e));
    } finally {
      setBackupStatus(null);
    }
  }

  async function restore() {
    let bytes: Uint8Array | null;
    try {
      bytes = await pickBackupFile();
    } catch (e) {
      showAlert('Dosya açılamadı', errorMessage(e));
      return;
    }
    if (!bytes) return;
    setBackupStatus({ kind: 'restore', text: 'Okunuyor' });
    let preview: Awaited<ReturnType<typeof previewRestore>>;
    try {
      preview = await previewRestore(bytes);
    } catch (e) {
      setBackupStatus(null);
      showAlert('Geri yüklenemedi', errorMessage(e));
      return;
    }
    setBackupStatus(null);
    const date = preview.createdAt ? new Date(preview.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    if (preview.toInsert.length === 0) {
      showAlert('Eklenecek fiş yok', `Yedekteki ${preview.total} fişin hepsi hesabınızda zaten var.`);
      return;
    }
    showActionSheet({
      title: 'Yedekten Geri Yükle',
      message: `${date ? `${date} tarihli yedek. ` : ''}${preview.toInsert.length} fiş eklenecek${preview.skipped ? `, hesabınızda zaten olan ${preview.skipped} fiş atlanacak` : ''}. Mevcut fişleriniz silinmez.`,
      options: [
        {
          label: `${preview.toInsert.length} Fişi Ekle`,
          onPress: async () => {
            setBackupStatus({ kind: 'restore', text: 'Başlıyor' });
            try {
              const r = await applyRestore(preview, (done, total) => setBackupStatus({ kind: 'restore', text: `${done}/${total}` }));
              setCount((c) => (c === null ? c : c + r.inserted));
              if (r.failed || r.photoFailed) {
                haptics.error();
                showAlert(
                  'Geri yükleme tamamlandı',
                  `${r.inserted} fiş eklendi.${r.failed ? ` ${r.failed} fiş eklenemedi (bağlantıyı kontrol edip yedeği yeniden yükleyebilirsiniz; eklenenler tekrar eklenmez).` : ''}${r.photoFailed ? ` ${r.photoFailed} fişin fotoğrafı yüklenemedi.` : ''}`,
                );
              } else {
                haptics.success();
                showToast(`${r.inserted} fiş geri yüklendi`);
              }
            } catch (e) {
              showAlert('Geri yüklenemedi', errorMessage(e));
            } finally {
              setBackupStatus(null);
            }
          },
        },
      ],
    });
  }

  const ratio = usage ? usage.bytes / STORAGE_QUOTA : 0;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ headerRight: () => <HeaderTextButton title="Bitti" bold onPress={() => router.back()} /> }} />

      <View style={[styles.account, { backgroundColor: theme.card }]}>
        <View style={[styles.avatar, { backgroundColor: theme.gray }]}>
          <Text style={styles.avatarText}>{(email[0] ?? '?').toLocaleUpperCase('tr-TR')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[t.title3, { color: theme.label }]} numberOfLines={1}>
            {email || 'Hesap'}
          </Text>
          <Text style={[t.subhead, { color: theme.secondaryLabel }]}>Supabase hesabı</Text>
        </View>
      </View>

      <ListSection
        header="Takip"
        footer={
          remindersSupported
            ? 'Hatırlatıcı; KDV, geçici vergi ve yıllık gelir vergisi son günlerinden 3 gün önce ve son gün bildirim gönderir. Hafta sonu ve bayram kaymaları hesaba katılır.'
            : undefined
        }>
        <ListRow
          title="Vergi Takvimi"
          icon={{ sf: 'calendar', ion: 'calendar', color: theme.red }}
          onPress={() => router.push('/tax-calendar')}
          chevron
        />
        {remindersSupported ? (
          <ListRow
            title="Vergi Hatırlatıcısı"
            icon={{ sf: 'bell.badge.fill', ion: 'notifications', color: theme.red }}
            accessory={<Switch value={reminder} onValueChange={toggleReminder} />}
          />
        ) : null}
        <ListRow
          title="Aylık Bütçe"
          value={budget ? formatTL(budget) : 'Yok'}
          icon={{ sf: 'chart.pie.fill', ion: 'pie-chart', color: theme.orange }}
          onPress={() => router.push('/budget')}
          chevron
        />
      </ListSection>

      <ListSection header="Veriler" footer="Fotoğraflar Supabase'in ücretsiz 1 GB alanında saklanır. Arşiv fotoğrafları sıkıştırılarak (~50–120 KB) kaydedilir.">
        <ListRow title="Fiş Sayısı" value={count === null ? '—' : String(count)} icon={{ sf: 'doc.text.fill', ion: 'document-text', color: theme.blue }} />
        <ListRow
          title="Fotoğraf Alanı"
          value={usage ? `${formatBytes(usage.bytes)} · %${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0).replace('.', ',')}` : '—'}
          icon={{ sf: 'externaldrive.fill', ion: 'server', color: theme.gray }}>
          {usage && (
            <View style={styles.meterWrap}>
              <View style={[styles.meter, { backgroundColor: theme.tertiaryFill }]}>
                <View style={{ width: `${Math.min(100, Math.max(ratio * 100, 0.5))}%`, backgroundColor: ratio > 0.8 ? theme.red : ratio > 0.6 ? theme.orange : theme.blue }} />
              </View>
              <Text style={[t.caption1, tabular, { color: theme.secondaryLabel }]}>
                {usage.files} dosya · 1 GB&apos;ın {formatBytes(usage.bytes)} kadarı kullanılıyor
              </Text>
            </View>
          )}
        </ListRow>
        <ListRow
          title="Tüm Fişleri Excel'e Aktar"
          icon={{ sf: 'tablecells.fill', ion: 'grid', color: theme.green }}
          onPress={exportAll}
          disabled={exporting}
          accessory={exporting ? <ActivityIndicator /> : undefined}
          chevron={!exporting}
        />
      </ListSection>

      <ListSection
        header="Yedek"
        footer="Tüm fişler ve fotoğrafları tek bir dosyaya kaydedilir; iPhone'da Dosyalar → iCloud Drive'a kaydedebilirsiniz. Geri yüklerken hesabınızda zaten olan fişler atlanır, hiçbir fiş silinmez.">
        <ListRow
          title="Tam Yedek Al"
          icon={{ sf: 'icloud.and.arrow.up.fill', ion: 'cloud-upload', color: theme.blue }}
          onPress={backup}
          disabled={!!backupStatus}
          value={backupStatus?.kind === 'backup' ? backupStatus.text : undefined}
          accessory={backupStatus?.kind === 'backup' ? <ActivityIndicator /> : undefined}
          chevron={!backupStatus}
        />
        <ListRow
          title="Yedekten Geri Yükle"
          icon={{ sf: 'icloud.and.arrow.down.fill', ion: 'cloud-download', color: theme.teal }}
          onPress={restore}
          disabled={!!backupStatus}
          value={backupStatus?.kind === 'restore' ? backupStatus.text : undefined}
          accessory={backupStatus?.kind === 'restore' ? <ActivityIndicator /> : undefined}
          chevron={!backupStatus}
        />
      </ListSection>

      <ListSection header="Yapay Zekâ" footer="Fiş fotoğrafları okunmak üzere bu sağlayıcıya gönderilir. Model yoğunsa uygulama otomatik olarak yedek modellere geçer.">
        <ListRow title="Sağlayıcı" value={vision?.providerName ?? 'Tanımsız'} icon={{ sf: 'sparkles', ion: 'sparkles', color: theme.purple }} />
        <ListRow title="Model" value={vision?.modelLabel ?? '—'} />
      </ListSection>

      <ListSection header="Uygulama">
        <ListRow title="Sürüm" value={VERSION_LABEL} icon={{ sf: 'info.circle.fill', ion: 'information-circle', color: theme.gray }} />
        <ListRow title="Sürüm Geçmişi" icon={{ sf: 'clock.arrow.circlepath', ion: 'time', color: theme.indigo }} onPress={() => Linking.openURL(`${REPO_URL}/blob/claude/pos-receipt-scanner-app-tk3b0z/CHANGELOG.md`)} chevron />
        <ListRow title="Web Sürümünü Aç" icon={{ sf: 'safari.fill', ion: 'globe', color: theme.blue }} onPress={() => Linking.openURL('https://mylifer.github.io/scan/')} chevron />
      </ListSection>

      <ListSection>
        <ListRow
          title="Çıkış Yap"
          tone="destructive"
          onPress={() => confirmDestructive('Çıkış Yap', 'Fişleriniz hesabınızda saklanmaya devam eder.', 'Çıkış Yap', async () => {
            await clearCache();
            await supabase.auth.signOut();
          })}
        />
      </ListSection>
    </ScrollView>
  );
}

function safeVision() {
  try {
    return getVisionService();
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  account: { marginHorizontal: 16, marginBottom: 28, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '600' },
  meterWrap: { paddingLeft: 16 + 29 + 12, paddingRight: 16, paddingBottom: 12, gap: 6 },
  meter: { height: 6, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
});
