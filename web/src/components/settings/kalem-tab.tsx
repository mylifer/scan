"use client";

import { formatTL } from "@shared/lib/format";
import { FlaskConical, ListChecks, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Chip, ListBox, Select, Skeleton, Spinner, Table, toast } from "@heroui/react";
import {
  KALEM_MODELLERI,
  kalemDenemesiYap,
  kalemDurumlari,
  type KalemDenemeSonucu,
  type KalemDurumlari,
  type KalemModeli,
} from "@/lib/kalemler";

const ADET_SECENEKLERI = ["5", "10", "20"] as const;

/** Ayarlar → Fiş Kalemleri: okuma durumu ve eski fişler için kalite denemesi */
export function KalemTab() {
  const [durum, setDurum] = useState<KalemDurumlari | null | undefined>(undefined);
  const [model, setModel] = useState<KalemModeli>("gemini-3.5-flash-lite");
  const [adet, setAdet] = useState<string>("20");
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState<KalemDenemeSonucu | null>(null);

  const yukle = useCallback(() => {
    void kalemDurumlari()
      .then(setDurum)
      .catch((e: unknown) => {
        setDurum(null);
        toast.danger(e instanceof Error ? e.message : "Kalem durumu alınamadı.");
      });
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const secili = KALEM_MODELLERI.find((m) => m.id === model)!;
  const kotaUyarisi = secili.gunluk <= 20;

  const denemeYap = async () => {
    setCalisiyor(true);
    setSonuc(null);
    try {
      const r = await kalemDenemesiYap(model, Number(adet), setSonuc);
      setSonuc(r);
      if (r.dolanModeller.length) toast.warning(`${secili.ad} kotası doldu ya da yoğun; deneme erken bitti.`);
      else toast.success(`${r.okundu + r.bos} fiş okundu.`);
      yukle();
    } catch (e) {
      toast.danger(e instanceof Error ? e.message : "Deneme çalıştırılamadı.");
    } finally {
      setCalisiyor(false);
    }
  };

  const okunan = sonuc ? sonuc.okundu + sonuc.bos : 0;

  return (
    <div className="space-y-6">
      <Card>
        <Card.Header className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ListChecks className="size-5 text-accent" />
              <Card.Title>Fiş Kalemleri</Card.Title>
            </div>
            <Card.Description>
              Yeni fişlerde ürün satırları tarama sırasında okunur. Eski fişler, Gemini günlük kotası sıfırlanmadan
              önceki saatte (Türkiye saatiyle kışın 10:00–10:55, yazın 09:00–09:55) o gün kullanılmayan kotayla
              arşivdeki fotoğraftan okunur. Fişin tutar ve KDV bilgilerine dokunulmaz.
            </Card.Description>
          </div>
          <Button size="sm" variant="outline" isIconOnly aria-label="Yenile" onPress={yukle}>
            <RefreshCw className="size-4" />
          </Button>
        </Card.Header>
        <Card.Content>
          {durum === undefined ? (
            <Skeleton className="h-16 w-full rounded-lg" />
          ) : durum === null ? (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Kurulum bekleniyor</Alert.Title>
                <Alert.Description>
                  Fiş kalemleri için veritabanı kurulumu (009) henüz yapılmamış. GitHub Actions → &quot;Veritabanı
                  kurulumu&quot; iş akışını çalıştırın.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Sayac etiket="Kalemleri okunan" deger={durum.okundu} />
              <Sayac etiket="Okunmayı bekleyen" deger={durum.bekleyen} />
              <Sayac etiket="Kalemi olmayan" deger={durum.yok} />
              <Sayac etiket="Okunamayan" deger={durum.okunamadi} />
            </div>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <FlaskConical className="size-5 text-accent" />
            <Card.Title>Eski Fişlerde Deneme</Card.Title>
          </div>
          <Card.Description>
            Okunmayı bekleyen en yeni fişlerden seçtiğiniz kadarını şimdi okutur. Kalem toplamı fiş toplamını
            tutuyorsa (±%1) okuma güvenilir sayılır; modelleri bu oranla karşılaştırabilirsiniz.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              className="w-60"
              aria-label="Model"
              variant="secondary"
              value={model}
              onChange={(k) => setModel(String(k) as KalemModeli)}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {KALEM_MODELLERI.map((m) => (
                    <ListBox.Item key={m.id} id={m.id}>
                      {m.ad}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Select className="w-32" aria-label="Fiş sayısı" variant="secondary" value={adet} onChange={(k) => setAdet(String(k))}>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {ADET_SECENEKLERI.map((a) => (
                    <ListBox.Item key={a} id={a}>
                      {a} fiş
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Button isDisabled={calisiyor || !durum || durum.bekleyen === 0} onPress={() => void denemeYap()}>
              {calisiyor ? <Spinner size="sm" /> : <FlaskConical className="size-4" />}
              {calisiyor ? "Okunuyor…" : "Denemeyi Başlat"}
            </Button>
          </div>

          {kotaUyarisi && (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{secili.ad} günde yalnızca {secili.gunluk} istek hakkına sahip</Alert.Title>
                <Alert.Description>
                  Deneme bugünkü hakkınızdan düşer; bugün taradığınız fişler gerekirse yedek modellerle okunur.
                  Model dakikada 5 istekle sınırlı olduğu için 20 fiş yaklaşık 4–5 dakika sürer.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {calisiyor && (
            <p className="text-sm text-muted">Fişler sırayla okunuyor; bu pencereyi kapatmayın.</p>
          )}

          {sonuc && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="secondary">{okunan} fiş okundu</Chip>
                <Chip size="sm" variant="soft" color={sonuc.tutarli >= okunan * 0.8 ? "success" : "warning"}>
                  {sonuc.tutarli} / {okunan} tutarlı
                </Chip>
                {sonuc.bos > 0 && <Chip size="sm" variant="secondary">{sonuc.bos} fişte kalem yok</Chip>}
                {sonuc.okunamadi > 0 && <Chip size="sm" variant="soft" color="danger">{sonuc.okunamadi} okunamadı</Chip>}
                {sonuc.kalan !== null && <Chip size="sm" variant="secondary">{sonuc.kalan} fiş bekliyor</Chip>}
              </div>
              {sonuc.sonuclar.length > 0 && (
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Deneme sonuçları" className="min-w-[640px]">
                      <Table.Header>
                        <Table.Column isRowHeader>Firma</Table.Column>
                        <Table.Column className="text-right">Fiş toplamı</Table.Column>
                        <Table.Column className="text-right">Kalem toplamı</Table.Column>
                        <Table.Column className="text-right">Kalem</Table.Column>
                        <Table.Column>Durum</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {sonuc.sonuclar.map((s) => (
                          <Table.Row key={s.id} id={s.id}>
                            <Table.Cell className="max-w-xs truncate">{s.firma || "—"}</Table.Cell>
                            <Table.Cell className="text-right tabular-nums">{formatTL(s.toplam)}</Table.Cell>
                            <Table.Cell className="text-right tabular-nums">{s.kalemAdedi ? formatTL(s.kalemToplami) : "—"}</Table.Cell>
                            <Table.Cell className="text-right tabular-nums">{s.kalemAdedi}</Table.Cell>
                            <Table.Cell>
                              {s.kalemAdedi === 0 ? (
                                <Chip size="sm" variant="secondary">Kalem yok</Chip>
                              ) : s.tutarli ? (
                                <Chip size="sm" variant="soft" color="success">Tutarlı</Chip>
                              ) : (
                                <Chip size="sm" variant="soft" color="warning">Eksik/yanlış olabilir</Chip>
                              )}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              )}
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}

function Sayac({ etiket, deger }: { etiket: string; deger: number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">{etiket}</p>
      <p className="text-2xl font-semibold tabular-nums">{deger.toLocaleString("tr-TR")}</p>
    </div>
  );
}
