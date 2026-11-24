"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  Alert,
  AlertDialog,
  Button,
  Card,
  Checkbox,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  TextArea,
  toast,
} from "@heroui/react";
import { formatTL } from "@shared/lib/format";
import {
  BILINMEYEN_TCKN,
  BIRIMLER,
  FaturaKesError,
  KDV_ORANLARI,
  dogrula,
  faturaKes,
  hesapla,
  kesimDurumu,
  mukellefSorgula,
  onizle,
  simdiIstanbul,
  type FaturaGirdi,
  type Kalem,
  type KesimOrtami,
  type KesimSonucu,
  type Senaryo,
  type Taraf,
} from "@shared/services/efatura/faturaKes";
import { PageHeader } from "@/components/layout/page-header";
import { kesInvoker, saticiOku, saticiYaz, sayiOku, seriTemizle, type SaticiBilgisi } from "@/lib/faturaKes";

interface SatirForm {
  id: number;
  ad: string;
  miktar: string;
  birim: string;
  birimFiyat: string;
  kdvOrani: string;
  iskonto: string;
}

const yeniSatir = (id: number): SatirForm => ({ id, ad: "", miktar: "1", birim: "C62", birimFiyat: "", kdvOrani: "20", iskonto: "" });

const BOS_ALICI: Taraf = { vknTckn: "", unvan: "", ad: "", soyad: "", vergiDairesi: "", adres: "", ilce: "", il: "", eposta: "", telefon: "" };

function satirdanKalem(s: SatirForm): Kalem {
  const iskonto = sayiOku(s.iskonto);
  return {
    ad: s.ad,
    miktar: sayiOku(s.miktar),
    birim: s.birim,
    birimFiyat: sayiOku(s.birimFiyat),
    kdvOrani: Number(s.kdvOrani),
    iskontoOrani: Number.isFinite(iskonto) ? iskonto : undefined,
  };
}

const ORTAM_ETIKET: Record<KesimOrtami, string> = { kapali: "Kapalı", test: "TEST", canli: "GERÇEK" };

function Alan({
  id,
  label,
  value,
  onChange,
  zorunlu,
  placeholder,
  type = "text",
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  zorunlu?: boolean;
  placeholder?: string;
  type?: string;
  inputMode?: "decimal" | "numeric" | "email" | "tel";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {zorunlu && <span className="text-danger">*</span>}
      </Label>
      <Input
        fullWidth
        variant="secondary"
        id={id}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Secim({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; ad: string }[];
  className?: string;
}) {
  return (
    <Select variant="secondary" className={className ?? "w-full gap-2"} value={value} onChange={(k) => onChange(String(k))} aria-label={label}>
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.ad}>
              {o.ad}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function FaturaKesView() {
  const [ortam, setOrtam] = useState<KesimOrtami | null>(null);
  const [saticiVkn, setSaticiVkn] = useState<string | null>(null);
  const [durumHata, setDurumHata] = useState<string | null>(null);

  const [satici, setSatici] = useState<SaticiBilgisi>(() => saticiOku());
  // Satıcı bilgisi eksikse o bölüm açık gelir
  const [saticiAcik, setSaticiAcik] = useState(() => !satici.il || !(satici.unvan || satici.ad));

  const [alici, setAlici] = useState<Taraf>(BOS_ALICI);
  const [bilinmeyen, setBilinmeyen] = useState(false);
  const [mukellef, setMukellef] = useState<{ vkn: string; efatura: boolean } | null>(null);
  const [sorgulaniyor, setSorgulaniyor] = useState(false);
  const [senaryo, setSenaryo] = useState<Senaryo>("TEMELFATURA");

  const [satirlar, setSatirlar] = useState<SatirForm[]>([yeniSatir(1)]);
  const [tarih, setTarih] = useState(() => simdiIstanbul().tarih);
  const [not, setNot] = useState("");
  const [ettn, setEttn] = useState(() => crypto.randomUUID());

  const [hatalar, setHatalar] = useState<string[]>([]);
  const [kontrol, setKontrol] = useState(false);
  const [onayAcik, setOnayAcik] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sonuc, setSonuc] = useState<KesimSonucu | null>(null);

  useEffect(() => {
    let iptal = false;
    kesimDurumu(kesInvoker)
      .then((d) => {
        if (iptal) return;
        setOrtam(d.ortam);
        setSaticiVkn(d.saticiVkn);
      })
      .catch((e) => !iptal && setDurumHata(e instanceof Error ? e.message : String(e)));
    return () => {
      iptal = true;
    };
  }, []);

  const saticiSahis = (saticiVkn?.length ?? 0) === 11;
  const aliciNo = bilinmeyen ? BILINMEYEN_TCKN : alici.vknTckn.trim();
  const aliciSahis = aliciNo.length === 11;
  const tur: "efatura" | "earsiv" | null = bilinmeyen
    ? "earsiv"
    : mukellef && mukellef.vkn === aliciNo
      ? mukellef.efatura
        ? "efatura"
        : "earsiv"
      : null;

  const kalemler = useMemo(() => satirlar.map(satirdanKalem), [satirlar]);
  const toplam = useMemo(() => hesapla(kalemler.map((k) => ({ ...k, miktar: k.miktar || 0, birimFiyat: k.birimFiyat || 0 }))), [kalemler]);

  const saticiTaraf: Omit<Taraf, "vknTckn"> = {
    unvan: satici.unvan,
    ad: satici.ad,
    soyad: satici.soyad,
    vergiDairesi: satici.vergiDairesi,
    adres: satici.adres,
    ilce: satici.ilce,
    il: satici.il,
    eposta: satici.eposta,
    telefon: satici.telefon,
  };

  const girdi = (): FaturaGirdi => ({
    tur: tur ?? "earsiv",
    senaryo,
    ettn,
    tarih,
    saat: simdiIstanbul().saat,
    alici: bilinmeyen
      ? { vknTckn: BILINMEYEN_TCKN, ad: alici.ad || "Nihai", soyad: alici.soyad || "Tüketici", il: alici.il, ilce: alici.ilce, adres: alici.adres, eposta: alici.eposta }
      : { ...alici, vknTckn: aliciNo },
    kalemler,
    not: not.trim() || undefined,
  });

  const setA = (k: keyof Taraf) => (v: string) => setAlici((a) => ({ ...a, [k]: v }));
  const setS = (k: keyof SaticiBilgisi) => (v: string) =>
    setSatici((s) => ({ ...s, [k]: k === "efaturaSeri" || k === "earsivSeri" ? seriTemizle(v) : v }));
  const setSatir = (id: number, k: keyof SatirForm, v: string) => setSatirlar((l) => l.map((s) => (s.id === id ? { ...s, [k]: v } : s)));

  async function sorgula() {
    if (!/^\d{10,11}$/.test(aliciNo)) {
      toast.danger("10 haneli vergi numarası ya da 11 haneli T.C. kimlik numarası girin.");
      return;
    }
    setSorgulaniyor(true);
    try {
      setMukellef({ vkn: aliciNo, efatura: await mukellefSorgula(kesInvoker, aliciNo) });
    } catch (e) {
      toast.danger(e instanceof Error ? e.message : String(e));
    } finally {
      setSorgulaniyor(false);
    }
  }

  async function kontrolEt() {
    if (!tur) {
      setHatalar(["Önce alıcının numarasını sorgulayın (e-Fatura mı e-Arşiv mi kesileceği buna göre belirlenir)."]);
      return;
    }
    if (tur === "efatura" && satici.efaturaSeri.length !== 3) {
      setHatalar(["Bilgileriniz bölümünde 3 karakterlik e-Fatura serisini girin (ör. ABC)."]);
      setSaticiAcik(true);
      return;
    }
    const g = girdi();
    const yerel = dogrula(g, { ...saticiTaraf, vknTckn: saticiVkn ?? "" });
    if (yerel.length) {
      setHatalar(yerel);
      return;
    }
    setKontrol(true);
    try {
      await onizle(kesInvoker, g, saticiTaraf);
      setHatalar([]);
      saticiYaz(satici);
      setOnayAcik(true);
    } catch (e) {
      setHatalar(e instanceof FaturaKesError && e.hatalar.length ? e.hatalar : [e instanceof Error ? e.message : String(e)]);
    } finally {
      setKontrol(false);
    }
  }

  async function gonder() {
    if (!ortam || ortam === "kapali" || !tur) return;
    setGonderiliyor(true);
    try {
      const seri = tur === "efatura" ? satici.efaturaSeri : satici.earsivSeri;
      const r = await faturaKes(kesInvoker, girdi(), saticiTaraf, seri, ortam);
      setOnayAcik(false);
      setSonuc(r);
      // Yeni fatura için temiz form ve yeni ETTN
      setEttn(crypto.randomUUID());
      setSatirlar([yeniSatir(1)]);
      setNot("");
      setAlici(BOS_ALICI);
      setBilinmeyen(false);
      setMukellef(null);
    } catch (e) {
      // ETTN değişmez: fatura aslında gittiyse tekrar gönderimi QNB reddeder, çift fatura oluşmaz
      setOnayAcik(false);
      setHatalar(e instanceof FaturaKesError && e.hatalar.length ? e.hatalar : [e instanceof Error ? e.message : String(e)]);
    } finally {
      setGonderiliyor(false);
    }
  }

  const saticiOzet = [saticiSahis ? `${satici.ad} ${satici.soyad}`.trim() : satici.unvan, satici.vergiDairesi, [satici.ilce, satici.il].filter(Boolean).join(" / ")]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader title="Fatura Kes" description="Müşterinize e-Fatura ya da e-Arşiv fatura kesin. Tür, alıcının numarasına göre kendiliğinden seçilir." />

      {durumHata && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Fatura kesme servisine ulaşılamadı</Alert.Title>
            <Alert.Description>{durumHata}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {ortam === "kapali" && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Fatura kesme henüz açık değil</Alert.Title>
            <Alert.Description>
              Formu doldurup kontrol edebilirsiniz ama fatura gönderilemez. QNB test hesabı tanımlanınca önce test ortamında denenecek.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {ortam === "test" && (
        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>TEST ortamı</Alert.Title>
            <Alert.Description>Burada kesilen faturalar gerçek değildir; GİB&apos;e gitmez, vergi kaydı oluşturmaz.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {ortam === "canli" && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>GERÇEK ortam</Alert.Title>
            <Alert.Description>Kesilen faturalar resmi belgedir ve alıcıya gider. Göndermeden önce bilgileri dikkatle kontrol edin.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* Satıcı */}
      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Card.Title>Bilgileriniz (satıcı)</Card.Title>
              <Card.Description>
                {saticiVkn ? `VKN/TCKN: ${saticiVkn}` : "VKN, QNB hesabınızdan gelir."}
                {!saticiAcik && saticiOzet ? ` · ${saticiOzet}` : ""}
              </Card.Description>
            </div>
            <Button size="sm" variant="tertiary" onPress={() => setSaticiAcik((v) => !v)}>
              {saticiAcik ? "Gizle" : "Düzenle"}
            </Button>
          </div>
        </Card.Header>
        {saticiAcik && (
          <Card.Content>
            <div className="grid gap-4 sm:grid-cols-2">
              {saticiSahis ? (
                <>
                  <Alan id="s-ad" label="Ad" value={satici.ad ?? ""} onChange={setS("ad")} zorunlu />
                  <Alan id="s-soyad" label="Soyad" value={satici.soyad ?? ""} onChange={setS("soyad")} zorunlu />
                </>
              ) : (
                <div className="sm:col-span-2">
                  <Alan id="s-unvan" label="Unvan" value={satici.unvan ?? ""} onChange={setS("unvan")} zorunlu placeholder="Örn: Örnek Ticaret Ltd. Şti." />
                </div>
              )}
              <Alan id="s-vd" label="Vergi dairesi" value={satici.vergiDairesi ?? ""} onChange={setS("vergiDairesi")} zorunlu={!saticiSahis} />
              <Alan id="s-adres" label="Adres" value={satici.adres ?? ""} onChange={setS("adres")} />
              <Alan id="s-ilce" label="İlçe" value={satici.ilce} onChange={setS("ilce")} zorunlu />
              <Alan id="s-il" label="İl" value={satici.il} onChange={setS("il")} zorunlu />
              <Alan id="s-eposta" label="E-posta" value={satici.eposta ?? ""} onChange={setS("eposta")} inputMode="email" />
              <Alan id="s-tel" label="Telefon" value={satici.telefon ?? ""} onChange={setS("telefon")} inputMode="tel" />
              <Alan id="s-efseri" label="e-Fatura serisi (3 karakter)" value={satici.efaturaSeri} onChange={setS("efaturaSeri")} placeholder="Örn: ABC" />
              <Alan id="s-easeri" label="e-Arşiv serisi (3 karakter)" value={satici.earsivSeri} onChange={setS("earsivSeri")} placeholder="Boşsa QNB'deki varsayılan" />
            </div>
            <p className="mt-3 text-sm text-muted">
              Seri, fatura numaranızın ilk 3 karakteridir (ör. ABC2026000000012 → ABC). QNB portalında tanımlı seriyi yazın.
            </p>
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                onPress={() => {
                  saticiYaz(satici);
                  setSaticiAcik(false);
                  toast.success("Bilgileriniz bu tarayıcıda kaydedildi.");
                }}
              >
                Kaydet
              </Button>
            </div>
          </Card.Content>
        )}
      </Card>

      {/* Alıcı */}
      <Card>
        <Card.Header>
          <Card.Title>Alıcı</Card.Title>
          <Card.Description>Şirket için vergi numarası (10 hane), şahıs için T.C. kimlik numarası (11 hane).</Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          <Checkbox isSelected={bilinmeyen} onChange={setBilinmeyen} variant="secondary">
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>
              <Label>Kimliği bilinmeyen müşteri (nihai tüketici, e-Arşiv)</Label>
            </Checkbox.Content>
          </Checkbox>

          {!bilinmeyen && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full sm:w-72">
                <Alan
                  id="a-no"
                  label="VKN / TCKN"
                  value={alici.vknTckn}
                  inputMode="numeric"
                  onChange={(v) => setA("vknTckn")(v.replace(/\D/g, "").slice(0, 11))}
                  zorunlu
                />
              </div>
              <Button variant="secondary" onPress={sorgula} isDisabled={sorgulaniyor || !/^\d{10,11}$/.test(aliciNo)}>
                {sorgulaniyor ? <Spinner size="sm" /> : <Search className="size-4" />}
                Sorgula
              </Button>
              {tur && (
                <Chip variant="soft" color={tur === "efatura" ? "accent" : "success"} className="mb-1.5">
                  {tur === "efatura" ? "e-Fatura mükellefi → e-Fatura kesilecek" : "e-Fatura mükellefi değil → e-Arşiv kesilecek"}
                </Chip>
              )}
            </div>
          )}

          {(tur || bilinmeyen) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {aliciSahis || bilinmeyen ? (
                <>
                  <Alan id="a-ad" label="Ad" value={alici.ad ?? ""} onChange={setA("ad")} zorunlu={!bilinmeyen} />
                  <Alan id="a-soyad" label="Soyad" value={alici.soyad ?? ""} onChange={setA("soyad")} zorunlu={!bilinmeyen} />
                </>
              ) : (
                <div className="sm:col-span-2">
                  <Alan id="a-unvan" label="Unvan" value={alici.unvan ?? ""} onChange={setA("unvan")} zorunlu />
                </div>
              )}
              {!aliciSahis && !bilinmeyen && <Alan id="a-vd" label="Vergi dairesi" value={alici.vergiDairesi ?? ""} onChange={setA("vergiDairesi")} zorunlu />}
              <Alan id="a-adres" label="Adres" value={alici.adres ?? ""} onChange={setA("adres")} />
              <Alan id="a-ilce" label="İlçe" value={alici.ilce} onChange={setA("ilce")} zorunlu />
              <Alan id="a-il" label="İl" value={alici.il} onChange={setA("il")} zorunlu />
              <Alan id="a-eposta" label="E-posta" value={alici.eposta ?? ""} onChange={setA("eposta")} inputMode="email" />
              {tur === "efatura" && (
                <Secim
                  label="Senaryo"
                  value={senaryo}
                  onChange={(v) => setSenaryo(v as Senaryo)}
                  options={[
                    { id: "TEMELFATURA", ad: "Temel fatura" },
                    { id: "TICARIFATURA", ad: "Ticari fatura (alıcı kabul/ret edebilir)" },
                  ]}
                />
              )}
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Satırlar */}
      <Card>
        <Card.Header>
          <Card.Title>Mal / Hizmet</Card.Title>
          <Card.Description>Fiyatlar KDV hariç girilir.</Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          {satirlar.map((s, i) => (
            <div key={s.id} className="grid gap-3 border-b border-separator pb-4 last:border-b-0 sm:grid-cols-12 sm:items-end">
              <div className="sm:col-span-4">
                <Alan id={`k-ad-${s.id}`} label={`${i + 1}. Mal/hizmet adı`} value={s.ad} onChange={(v) => setSatir(s.id, "ad", v)} zorunlu />
              </div>
              <div className="sm:col-span-1">
                <Alan id={`k-mik-${s.id}`} label="Miktar" value={s.miktar} inputMode="decimal" onChange={(v) => setSatir(s.id, "miktar", v)} />
              </div>
              <div className="sm:col-span-2">
                <Secim label="Birim" value={s.birim} onChange={(v) => setSatir(s.id, "birim", v)} options={BIRIMLER.map((b) => ({ id: b.kod, ad: b.ad }))} />
              </div>
              <div className="sm:col-span-2">
                <Alan id={`k-fiyat-${s.id}`} label="Birim fiyat (₺)" value={s.birimFiyat} inputMode="decimal" onChange={(v) => setSatir(s.id, "birimFiyat", v)} />
              </div>
              <div className="sm:col-span-1">
                <Secim label="KDV" value={s.kdvOrani} onChange={(v) => setSatir(s.id, "kdvOrani", v)} options={KDV_ORANLARI.map((o) => ({ id: String(o), ad: `%${o}` }))} />
              </div>
              <div className="sm:col-span-1">
                <Alan id={`k-isk-${s.id}`} label="İskonto %" value={s.iskonto} inputMode="decimal" onChange={(v) => setSatir(s.id, "iskonto", v)} />
              </div>
              <div className="flex items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                <span className="text-sm tabular-nums">{formatTL((toplam.kalemler[i]?.net ?? 0) + (toplam.kalemler[i]?.kdv ?? 0))}</span>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label="Satırı sil"
                  isDisabled={satirlar.length === 1}
                  onPress={() => setSatirlar((l) => l.filter((x) => x.id !== s.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="secondary" size="sm" onPress={() => setSatirlar((l) => [...l, yeniSatir(Math.max(...l.map((x) => x.id)) + 1)])}>
            <Plus className="size-4" />
            Satır ekle
          </Button>
        </Card.Content>
      </Card>

      {/* Toplam ve gönder */}
      <Card>
        <Card.Header>
          <Card.Title>Özet</Card.Title>
        </Card.Header>
        <Card.Content className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="w-full sm:w-56">
              <Alan id="tarih" label="Fatura tarihi" type="date" value={tarih} onChange={setTarih} zorunlu />
            </div>
            <div className="space-y-2">
              <Label htmlFor="not">Not (faturada görünür)</Label>
              <TextArea fullWidth variant="secondary" id="not" value={not} onChange={(e) => setNot(e.target.value)} placeholder="Örn: Ödeme 30 gün vadelidir." />
            </div>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Mal/hizmet toplamı</dt>
              <dd className="tabular-nums">{formatTL(toplam.brut)}</dd>
            </div>
            {toplam.iskonto > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">İskonto</dt>
                <dd className="tabular-nums">−{formatTL(toplam.iskonto)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">KDV matrahı</dt>
              <dd className="tabular-nums">{formatTL(toplam.matrah)}</dd>
            </div>
            {toplam.kdvSatirlari.map((k) => (
              <div key={k.oran} className="flex justify-between gap-4">
                <dt className="text-muted">KDV %{k.oran}</dt>
                <dd className="tabular-nums">{formatTL(k.kdv)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-separator pt-2 text-base font-semibold">
              <dt>Ödenecek tutar</dt>
              <dd className="tabular-nums">{formatTL(toplam.odenecek)}</dd>
            </div>
          </dl>
        </Card.Content>
      </Card>

      {hatalar.length > 0 && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Fatura kesilemedi / eksik bilgi var</Alert.Title>
            <Alert.Description>
              <ul className="list-disc ps-4">
                {hatalar.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button onPress={kontrolEt} isDisabled={kontrol || !ortam}>
          {kontrol && <Spinner size="sm" />}
          Kontrol et ve devam et
        </Button>
      </div>

      {/* Onay */}
      <AlertDialog.Backdrop isOpen={onayAcik} onOpenChange={(v) => !gonderiliyor && setOnayAcik(v)}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>
                {ortam === "kapali" ? "Fatura bilgileri doğru" : `${tur === "efatura" ? "e-Fatura" : "e-Arşiv fatura"} kesilsin mi?`}
              </AlertDialog.Heading>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted">Alıcı:</span>{" "}
                  {bilinmeyen ? "Nihai tüketici" : aliciSahis ? `${alici.ad} ${alici.soyad}` : alici.unvan} ({aliciNo})
                </p>
                <p>
                  <span className="text-muted">Ödenecek:</span> <span className="tabular-nums font-semibold">{formatTL(toplam.odenecek)}</span>{" "}
                  <span className="text-muted">(KDV {formatTL(toplam.kdv)})</span>
                </p>
                <p>
                  <span className="text-muted">Ortam:</span>{" "}
                  <Chip size="sm" variant="soft" color={ortam === "canli" ? "danger" : ortam === "test" ? "accent" : "warning"}>
                    {ortam ? ORTAM_ETIKET[ortam] : "…"}
                  </Chip>
                </p>
                {ortam === "kapali" && (
                  <p className="text-muted">Denetim başarılı. Fatura kesme açılınca bu fatura buradan gönderilebilecek.</p>
                )}
                {ortam === "canli" && <p className="text-danger">Bu fatura resmi belgedir; gönderildikten sonra kolayca geri alınamaz.</p>}
              </div>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary" size="sm" isDisabled={gonderiliyor}>
                {ortam === "kapali" ? "Kapat" : "Vazgeç"}
              </Button>
              {ortam !== "kapali" && (
                <Button size="sm" variant={ortam === "canli" ? "danger" : "primary"} onPress={gonder} isDisabled={gonderiliyor}>
                  {gonderiliyor && <Spinner size="sm" />}
                  {gonderiliyor ? "Gönderiliyor…" : ortam === "canli" ? "Evet, faturayı kes" : "Test faturası kes"}
                </Button>
              )}
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      {/* Sonuç */}
      <Modal.Backdrop isOpen={!!sonuc} onOpenChange={(v) => !v && setSonuc(null)}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Fatura kesildi{sonuc?.ortam === "test" ? " (TEST)" : ""}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Tür</dt>
                  <dd>{sonuc?.tur === "efatura" ? "e-Fatura" : "e-Arşiv"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Fatura no</dt>
                  <dd className="tabular-nums">{sonuc?.belgeNo || "QNB atayacak"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">ETTN</dt>
                  <dd className="break-all text-end">{sonuc?.ettn}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Durum</dt>
                  <dd>{sonuc?.durum}</dd>
                </div>
              </dl>
              {sonuc?.ortam === "canli" && (
                <p className="mt-3 text-sm text-muted">Fatura birkaç dakika içinde e-Faturalar sayfasındaki giden listesinde görünür.</p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close">Tamam</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
