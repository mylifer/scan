import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ListRow, ListSection } from '../../../components/ui/List';
import { Badge } from '../../../components/web/Badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/web/Card';
import { WebButton } from '../../../components/web/Button';
import { WebPageHeader } from '../../../components/web/PageHeader';
import { WebSwitch } from '../../../components/web/Switch';
import { useAuth } from '../../../hooks/useAuth';
import { confirmDestructive, showActionSheet } from '../../../lib/actionSheet';
import { showAlert } from '../../../lib/alert';
import { errorMessage } from '../../../lib/errors';
import { formatBytes, formatTL, monthRange } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useWide } from '../../../lib/layout';
import { tabular, type as t, useShadcnTheme, useTheme } from '../../../lib/theme';
import { HOST_APP_NAME, VERSION_LABEL } from '../../../lib/version';
import { useMonthlyBudget } from '../../../lib/budget';
import { showToast } from '../../../lib/toast';
import { disableReminder, enableReminder, isReminderEnabled, remindersSupported } from '../../../services/reminders/taxReminders';
import { disableMonthlySummary, enableMonthlySummary, isMonthlySummaryEnabled } from '../../../services/reminders/monthlySummary';
import { applyRestore, createBackup, previewRestore } from '../../../services/backup/backup';
import { pickBackupFile } from '../../../services/backup/pickBackupFile';
import { buildReceiptsWorkbook, exportFilename, shareXlsx, shareZipStream } from '../../../services/export/exportReceipts';
import { backupFilename } from '../../../lib/backupFormat';
import { clearCache } from '../../../lib/offlineCache';
import { supabase } from '../../../services/supabase/client';
import { countReceipts, getStorageUsage, getSummary, type StorageUsage } from '../../../services/supabase/receiptsRepository';
import { getVisionService } from '../../../services/vision';
import { trashReady } from '../../../services/supabase/schema';
import { lockAvailable, lockMethodLabel, setAppLock, useAppLockEnabled } from '../../../services/appLock';

/** Supabase free plan depolama kotası */
const STORAGE_QUOTA = 1024 * 1024 * 1024;
const REPO_URL = 'https://github.com/mylifer/scan';

export default function SettingsScreen() {
  const theme = useTheme();
  const st = useShadcnTheme();
  const wide = useWide();
  const { session } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [exporting, setExporting] = useState(false);
  const email = session?.user.email ?? '';
  const vision = safeVision();
  const budget = useMonthlyBudget();
  const [reminder, setReminder] = useState(false);

  const [monthly, setMonthly] = useState(false);
  const locked = useAppLockEnabled();
  const canLock = lockAvailable();
  const [lockLabel, setLockLabel] = useState('Face ID');
  useEffect(() => {
    if (canLock) lockMethodLabel().then(setLockLabel);
  }, [canLock]);

  async function toggleLock(on: boolean) {
    if (await setAppLock(on)) {
      haptics.success();
      showToast(on ? `Uygulama ${lockLabel} ile kilitlenecek` : 'Kilit kapatıldı');
    } else if (on) {
      haptics.error();
      showToast('Kimlik doğrulanamadı; kilit açılmadı', 'error');
    }
  }
  useEffect(() => {
    if (!remindersSupported) return;
    isReminderEnabled().then(setReminder);
    isMonthlySummaryEnabled().then(setMonthly);
  }, []);

  async function toggleMonthly(on: boolean) {
    setMonthly(on);
    try {
      if (on) {
        const s = await getSummary(monthRange(0));
        if (!(await enableMonthlySummary({ total: s.toplamGider, kdv: s.toplamKdv, count: s.fisSayisi }))) {
          setMonthly(false);
          showAlert('Bildirim izni gerekli', `Aylık özet için iPhone Ayarlar → Bildirimler → ${HOST_APP_NAME} bölümünden izin verin.`);
          return;
        }
        haptics.success();
        showToast('Her ayın 1’inde geçen ayın özeti gelecek');
      } else {
        await disableMonthlySummary();
      }
    } catch (e) {
      setMonthly(!on);
      showAlert('Aylık özet ayarlanamadı', errorMessage(e));
    }
  }

  async function toggleReminder(on: boolean) {
    setReminder(on);
    try {
      if (on) {
        if (!(await enableReminder())) {
          setReminder(false);
          showAlert('Bildirim izni gerekli', `Hatırlatıcı için iPhone Ayarlar → Bildirimler → ${HOST_APP_NAME} bölümünden izin verin.`);
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
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: wide ? 24 : 16, paddingHorizontal: wide ? 24 : 0, paddingBottom: 40 }}>
      {wide ? (
        <View style={{ maxWidth: 1200, width: '100%', alignSelf: 'center' }}>
          <WebPageHeader
            title="Ayarlar"
            description="Hesap bilgileri, depolama alanı, vergi takibi ve uygulama tercihleri."
          />

          <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
            {/* Sol Sütun: Hesap & Depolama & Yedek */}
            <View style={{ flex: 1, gap: 20 }}>
              {/* Hesap Kartı */}
              <Card>
                <CardHeader>
                  <CardTitle>Kullanıcı Hesabı</CardTitle>
                  <CardDescription>Oturum açtığınız Supabase hesabı.</CardDescription>
                </CardHeader>
                <CardContent style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={[styles.avatar, styles.avatarWide, { backgroundColor: st.muted, borderColor: st.border }]}>
                    <Text style={[styles.avatarText, { color: st.cardForeground, fontSize: 18 }]}>
                      {(email[0] ?? '?').toLocaleUpperCase('tr-TR')}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: st.cardForeground }} numberOfLines={1}>
                      {email || 'Kullanıcı'}
                    </Text>
                    <Badge variant="outline" style={{ alignSelf: 'flex-start' }}>Aktif Oturum</Badge>
                  </View>
                </CardContent>
                <CardFooter style={{ justifyContent: 'flex-end' }}>
                  <WebButton
                    variant="destructive"
                    size="sm"
                    onPress={() => confirmDestructive('Çıkış Yap', 'Fişleriniz hesabınızda saklanmaya devam eder.', 'Çıkış Yap', async () => {
                      await clearCache();
                      await supabase.auth.signOut();
                    })}>
                    Çıkış Yap
                  </WebButton>
                </CardFooter>
              </Card>

              {/* Veriler & Depolama Kartı */}
              <Card>
                <CardHeader>
                  <CardTitle>Veriler & Depolama</CardTitle>
                  <CardDescription>Kayıtlı fişler ve Supabase fotoğraf depolama kullanımı.</CardDescription>
                </CardHeader>
                <CardContent style={{ gap: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: st.mutedForeground }}>Kayıtlı Fiş Sayısı</Text>
                    <Badge variant="secondary">{count === null ? '—' : `${count} Fiş`}</Badge>
                  </View>

                  {usage && (
                    <View style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, color: st.mutedForeground }}>Fotoğraf Alanı (1 GB)</Text>
                        <Text style={[{ fontSize: 13, fontWeight: '600', color: st.cardForeground }, tabular]}>
                          {formatBytes(usage.bytes)} (%{(ratio * 100).toFixed(1)})
                        </Text>
                      </View>
                      <View style={[styles.meter, { backgroundColor: st.muted, height: 8, borderRadius: 4 }]}>
                        <View style={{ width: `${Math.min(100, Math.max(ratio * 100, 1))}%`, backgroundColor: ratio > 0.8 ? '#ef4444' : '#22c55e', borderRadius: 4 }} />
                      </View>
                      <Text style={{ fontSize: 12, color: st.mutedForeground }}>
                        {usage.files} arşiv fotoğrafı saklanıyor.
                      </Text>
                    </View>
                  )}

                  <View style={{ height: 1, backgroundColor: st.border, marginVertical: 4 }} />

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <WebButton variant="outline" size="sm" icon={{ sf: 'tag.fill', ion: 'pricetag' }} onPress={() => router.push('/categories')}>
                      Kategoriler
                    </WebButton>
                    <WebButton variant="outline" size="sm" icon={{ sf: 'building.2.fill', ion: 'business' }} onPress={() => router.push('/merge-firms')}>
                      Firma Birleştir
                    </WebButton>
                    <WebButton variant="outline" size="sm" icon={{ sf: 'trash.fill', ion: 'trash' }} onPress={async () => router.push((await trashReady()) === false ? '/setup-trash' : '/trash')}>
                      Son Silinenler
                    </WebButton>
                    <WebButton variant="outline" size="sm" icon={{ sf: 'tablecells.fill', ion: 'grid' }} onPress={exportAll} disabled={exporting}>
                      Excel&apos;e Aktar
                    </WebButton>
                  </View>
                </CardContent>
              </Card>

              {/* Yedekleme Kartı */}
              <Card>
                <CardHeader>
                  <CardTitle>Yedekleme & Geri Yükleme</CardTitle>
                  <CardDescription>
                    Tüm fişler ve fotoğrafları tek bir arşiv dosyasına yedeklenir. Geri yüklerken mevcut fişler mükerrer eklenmez.
                  </CardDescription>
                </CardHeader>
                <CardContent style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  <WebButton
                    variant="outline"
                    icon={{ sf: 'icloud.and.arrow.up.fill', ion: 'cloud-upload' }}
                    onPress={backup}
                    disabled={!!backupStatus}
                    loading={backupStatus?.kind === 'backup'}>
                    Tam Yedek Al
                  </WebButton>
                  <WebButton
                    variant="outline"
                    icon={{ sf: 'icloud.and.arrow.down.fill', ion: 'cloud-download' }}
                    onPress={restore}
                    disabled={!!backupStatus}
                    loading={backupStatus?.kind === 'restore'}>
                    Yedekten Geri Yükle
                  </WebButton>
                </CardContent>
              </Card>
            </View>

            {/* Sağ Sütun: Takip & Tercihler & Yapay Zeka */}
            <View style={{ flex: 1, gap: 20 }}>
              {/* Takip & Bütçe Kartı */}
              <Card>
                <CardHeader>
                  <CardTitle>Takip & Vergi Hatırlatıcıları</CardTitle>
                  <CardDescription>KDV, vergi takvimi ve aylık harcama bütçesi.</CardDescription>
                </CardHeader>
                <CardContent style={{ gap: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ gap: 2 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: st.cardForeground }}>Aylık Bütçe Hedefi</Text>
                      <Text style={{ fontSize: 12, color: st.mutedForeground }}>Aylık harcama limiti belirleyin.</Text>
                    </View>
                    <WebButton variant="outline" size="sm" onPress={() => router.push('/budget')}>
                      {budget ? formatTL(budget) : 'Bütçe Belirle'}
                    </WebButton>
                  </View>

                  <View style={{ height: 1, backgroundColor: st.border }} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ gap: 2 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: st.cardForeground }}>Resmi Vergi Takvimi</Text>
                      <Text style={{ fontSize: 12, color: st.mutedForeground }}>KDV, Muhtasar ve Geçici Vergi son günleri.</Text>
                    </View>
                    <WebButton variant="outline" size="sm" icon={{ sf: 'calendar', ion: 'calendar' }} onPress={() => router.push('/tax-calendar')}>
                      Takvimi Aç
                    </WebButton>
                  </View>

                  {remindersSupported && (
                    <>
                      <View style={{ height: 1, backgroundColor: st.border }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ gap: 2, flex: 1, paddingRight: 12 }}>
                          <Text style={{ fontSize: 14, fontWeight: '500', color: st.cardForeground }}>Vergi Hatırlatıcısı</Text>
                          <Text style={{ fontSize: 12, color: st.mutedForeground }}>Son günlerden 3 gün önce bildirim gönderir.</Text>
                        </View>
                        <WebSwitch checked={reminder} onCheckedChange={toggleReminder} />
                      </View>

                      <View style={{ height: 1, backgroundColor: st.border }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ gap: 2, flex: 1, paddingRight: 12 }}>
                          <Text style={{ fontSize: 14, fontWeight: '500', color: st.cardForeground }}>Aylık Özet Bildirimi</Text>
                          <Text style={{ fontSize: 12, color: st.mutedForeground }}>Her ayın 1’inde geçen ayın özetini bildirir.</Text>
                        </View>
                        <WebSwitch checked={monthly} onCheckedChange={toggleMonthly} />
                      </View>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Yapay Zekâ Kartı */}
              <Card>
                <CardHeader>
                  <CardTitle>Yapay Zekâ Motoru</CardTitle>
                  <CardDescription>Fiş okuma ve görsel işleme servisi.</CardDescription>
                </CardHeader>
                <CardContent style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: st.mutedForeground }}>Sağlayıcı</Text>
                    <Badge variant="secondary">{vision?.providerName ?? 'Gemini Vision (Edge)'}</Badge>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: st.mutedForeground }}>Model</Text>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: st.cardForeground }}>{vision?.modelLabel ?? 'Gemini 2.5 Flash'}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: st.mutedForeground, marginTop: 4 }}>
                    Fiş fotoğrafları güvenli sunucu fonksiyonu üzerinden işlenir. API anahtarı istemcide tutulmaz.
                  </Text>
                </CardContent>
              </Card>

              {/* Uygulama Bilgileri */}
              <Card>
                <CardHeader>
                  <CardTitle>Uygulama Bilgileri</CardTitle>
                </CardHeader>
                <CardContent style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: st.mutedForeground }}>Sürüm</Text>
                    <Badge variant="outline">v{VERSION_LABEL}</Badge>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <WebButton variant="ghost" size="sm" onPress={() => Linking.openURL(`${REPO_URL}/blob/claude/pos-receipt-scanner-app-tk3b0z/CHANGELOG.md`)}>
                      Sürüm Geçmişi
                    </WebButton>
                    <WebButton variant="ghost" size="sm" onPress={() => router.push('/errors')}>
                      Hata Kayıtları
                    </WebButton>
                    <WebButton variant="ghost" size="sm" onPress={() => Linking.openURL(REPO_URL)}>
                      GitHub
                    </WebButton>
                  </View>
                </CardContent>
              </Card>
            </View>
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.account, { backgroundColor: theme.card }]}>
            <View style={[styles.avatar, { backgroundColor: theme.gray, borderColor: st.border }]}>
              <Text style={styles.avatarText}>{(email[0] ?? '?').toLocaleUpperCase('tr-TR')}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
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
                ? 'Hatırlatıcı; KDV, geçici vergi ve yıllık gelir vergisi son günlerinden 3 gün önce ve son gün bildirim gönderir. Hafta sonu ve bayram kaymaları hesaba katılır. Aylık özet, her ayın 1’inde geçen ayın gider, KDV ve fiş sayısını bildirir.'
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
                accessory={<Switch value={reminder} onValueChange={toggleReminder} accessibilityLabel="Vergi hatırlatıcısı" />}
              />
            ) : null}
            {remindersSupported ? (
              <ListRow
                title="Aylık Özet Bildirimi"
                icon={{ sf: 'chart.bar.doc.horizontal.fill', ion: 'bar-chart', color: theme.indigo }}
                accessory={<Switch value={monthly} onValueChange={toggleMonthly} accessibilityLabel="Aylık özet bildirimi" />}
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

          {canLock ? (
            <ListSection
              header="Güvenlik"
              footer={`Açıkken uygulama açılışta ve 1 dakikadan uzun arka planda kaldıktan sonra ${lockLabel} ister. ${lockLabel} olmazsa telefon şifresiyle açılır.`}>
              <ListRow
                title={`${lockLabel} ile Kilitle`}
                icon={{ sf: 'faceid', ion: 'scan', color: theme.green }}
                accessory={<Switch value={locked} onValueChange={toggleLock} accessibilityLabel={`${lockLabel} ile kilitle`} />}
              />
            </ListSection>
          ) : null}

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
              title="Son Silinenler"
              icon={{ sf: 'trash.fill', ion: 'trash', color: theme.gray }}
              onPress={async () => router.push((await trashReady()) === false ? '/setup-trash' : '/trash')}
              chevron
            />
            <ListRow
              title="Kategoriler"
              icon={{ sf: 'tag.fill', ion: 'pricetag', color: theme.purple }}
              onPress={() => router.push('/categories')}
              chevron
            />
            <ListRow
              title="Firma Adlarını Birleştir"
              icon={{ sf: 'building.2.fill', ion: 'business', color: theme.indigo }}
              onPress={() => router.push('/merge-firms')}
              chevron
            />
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

          <ListSection header="Yapay Zekâ" footer={vision?.providerName.includes('sunucu') ? 'Fiş fotoğrafları uygulamanın sunucusu üzerinden okunur; yapay zekâ anahtarı uygulamanın içinde bulunmaz. Model yoğunsa otomatik olarak yedek modellere geçilir.' : 'Fiş fotoğrafları okunmak üzere bu sağlayıcıya gönderilir. Model yoğunsa uygulama otomatik olarak yedek modellere geçer.'}>
            <ListRow title="Sağlayıcı" value={vision?.providerName ?? 'Tanımsız'} icon={{ sf: 'sparkles', ion: 'sparkles', color: theme.purple }} />
            <ListRow title="Model" value={vision?.modelLabel ?? '—'} />
          </ListSection>

          <ListSection header="Uygulama">
            <ListRow title="Sürüm" value={VERSION_LABEL} icon={{ sf: 'info.circle.fill', ion: 'information-circle', color: theme.gray }} />
            <ListRow title="Sürüm Geçmişi" icon={{ sf: 'clock.arrow.circlepath', ion: 'time', color: theme.indigo }} onPress={() => Linking.openURL(`${REPO_URL}/blob/claude/pos-receipt-scanner-app-tk3b0z/CHANGELOG.md`)} chevron />
            <ListRow
              title="Hata Kayıtları"
              icon={{ sf: 'ladybug.fill', ion: 'bug', color: theme.orange }}
              onPress={() => router.push('/errors')}
              chevron
            />
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
        </>
      )}
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
  accountWide: { borderRadius: 8, borderWidth: 1, padding: 18, marginBottom: 20 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarWide: { width: 44, height: 44, borderRadius: 22, borderWidth: 1 },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '600' },
  meterWrap: { paddingLeft: 16 + 29 + 12, paddingRight: 16, paddingBottom: 12, gap: 6 },
  meter: { height: 6, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
});
