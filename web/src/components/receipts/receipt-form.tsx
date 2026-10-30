"use client";

import { allCategories, categoryLabel } from "@shared/lib/categories";
import { formatTL, parseAmount, round2 } from "@shared/lib/format";
import {
  emptyForm,
  formWarnings,
  fromFormValues,
  setFormField,
  toFormValues,
  validateForm,
  type ReceiptFormValues,
} from "@shared/lib/receiptForm";
import { recordToData } from "@shared/services/supabase/receiptRows";
import type { Kategori, ReceiptRecord } from "@shared/types/receipt";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Loader2,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createReceipt, deleteReceipt, getImageUrl, loadCustomCategories, updateReceipt } from "@/lib/receipts";

interface ReceiptFormProps {
  initialRecord?: ReceiptRecord;
  loadingRecord?: boolean;
}

export function ReceiptForm({ initialRecord, loadingRecord }: ReceiptFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(initialRecord);

  const [form, setForm] = useState<ReceiptFormValues>(() =>
    initialRecord ? toFormValues(recordToData(initialRecord)) : emptyForm(),
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [categories, setCategories] = useState<readonly Kategori[]>([]);

  // Özel kategorileri yükle
  useEffect(() => {
    void loadCustomCategories().then(() => {
      setCategories(allCategories());
    });
  }, []);

  // Varsa mevcut görselin signed URL'ini yükle
  useEffect(() => {
    if (!initialRecord?.image_path) return;
    let cancelled = false;
    void getImageUrl(initialRecord.image_path).then((url) => {
      if (!cancelled && url) setExistingImageUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [initialRecord?.image_path]);

  const updateField = <K extends keyof ReceiptFormValues>(key: K, value: ReceiptFormValues[K]) => {
    setForm((prev) => setFormField(prev, key, value));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Lütfen geçerli bir görsel dosyası seçin (JPEG, PNG vb.).");
        return;
      }
      setPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleClearPhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhotoFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Hızlı KDV hesaplama yardımcıları
  const applyQuickKdv = (rate: 1 | 10 | 20 | 0) => {
    const total = parseAmount(form.toplamTutar);
    if (total <= 0) {
      toast.info("Önce toplam tutarı girin.");
      return;
    }
    if (rate === 0) {
      setForm((prev) => ({
        ...prev,
        kdvYuzde1: "0,00",
        kdvYuzde10: "0,00",
        kdvYuzde20: "0,00",
      }));
      return;
    }
    const kdv = round2((total * rate) / (100 + rate));
    const kdvStr = kdv.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setForm((prev) => ({
      ...prev,
      kdvYuzde1: rate === 1 ? kdvStr : "0,00",
      kdvYuzde10: rate === 10 ? kdvStr : "0,00",
      kdvYuzde20: rate === 20 ? kdvStr : "0,00",
    }));
  };

  // Canlı hesaplamalar
  const totalAmount = parseAmount(form.toplamTutar);
  const kdv1 = parseAmount(form.kdvYuzde1);
  const kdv10 = parseAmount(form.kdvYuzde10);
  const kdv20 = parseAmount(form.kdvYuzde20);
  const totalKdv = round2(kdv1 + kdv10 + kdv20);
  const matrah = round2(Math.max(0, totalAmount - totalKdv));

  const warnings = useMemo(() => formWarnings(form), [form]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm(form);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    setSubmitting(true);
    try {
      const data = fromFormValues(form);
      if (initialRecord) {
        await updateReceipt(initialRecord, data, photoFile);
        toast.success("Fiş başarıyla güncellendi.");
      } else {
        await createReceipt(data, photoFile);
        toast.success("Fiş başarıyla kaydedildi.");
      }
      router.push("/fisler/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fiş kaydedilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialRecord) return;
    setDeleting(true);
    try {
      const result = await deleteReceipt(initialRecord.id);
      if (result === "trash") {
        toast.success("Fiş Son Silinenler'e taşındı (30 gün geri alınabilir).");
      } else {
        toast.success("Fiş kalıcı olarak silindi.");
      }
      router.push("/fisler/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silme işlemi başarısız.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loadingRecord) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fiş Yükleniyor…" />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCategories = categories.length > 0 ? categories : allCategories();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" asChild>
            <Link href="/fisler/" aria-label="Geri">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <PageHeader
            title={isEditing ? "Fişi Düzenle" : "Yeni Fiş Ekle"}
            description={
              isEditing
                ? `${initialRecord?.firma_adi ?? ""} fişinin detayları`
                : "Manuel fiş bilgisi girerek sisteme kaydedin"
            }
          />
        </div>

        <div className="flex items-center gap-2">
          {isEditing && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting}
            >
              <Trash2 className="size-4" />
              Sil
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/fisler/">Vazgeç</Link>
          </Button>
          <Button
            type="submit"
            form="receipt-form"
            size="sm"
            disabled={submitting}
            className="gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Kaydediliyor…
              </>
            ) : (
              <>
                <Save className="size-4" />
                Kaydet
              </>
            )}
          </Button>
        </div>
      </div>

      <form id="receipt-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sol 2 kolon: Form Alanları */}
        <div className="space-y-6 lg:col-span-2">
          {/* Ana Bilgiler */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Temel Bilgiler</CardTitle>
              <CardDescription>Firma, tarih ve kategori alanları zorunludur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firmaAdi">
                  Firma Adı <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firmaAdi"
                  placeholder="Örn: Migros, Shell, Metro Grossmarket"
                  value={form.firmaAdi}
                  onChange={(e) => updateField("firmaAdi", e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tarih">
                    Tarih <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tarih"
                    placeholder="GG.AA.YYYY (Örn: 24.10.2026)"
                    value={form.tarih}
                    onChange={(e) => updateField("tarih", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kategori">
                    Kategori <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.kategori}
                    onValueChange={(val) => updateField("kategori", val as Kategori)}
                  >
                    <SelectTrigger id="kategori" className="w-full">
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {activeCategories.map((kat) => (
                        <SelectItem key={kat} value={kat}>
                          {categoryLabel(kat)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toplamTutar">
                  Toplam Tutar (TL) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="toplamTutar"
                  placeholder="0,00"
                  className="font-medium tabular-nums"
                  value={form.toplamTutar}
                  onChange={(e) => updateField("toplamTutar", e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* KDV Dağılımı */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base font-semibold">KDV Dağılımı</CardTitle>
                <CardDescription>Fişteki vergi dilimlerini belirtin.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyQuickKdv(20)}
                >
                  %20 KDV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyQuickKdv(10)}
                >
                  %10 KDV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyQuickKdv(1)}
                >
                  %1 KDV
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => applyQuickKdv(0)}
                >
                  Sıfırla
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="kdvYuzde1">%1 KDV (TL)</Label>
                  <Input
                    id="kdvYuzde1"
                    placeholder="0,00"
                    className="tabular-nums"
                    value={form.kdvYuzde1}
                    onChange={(e) => updateField("kdvYuzde1", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kdvYuzde10">%10 KDV (TL)</Label>
                  <Input
                    id="kdvYuzde10"
                    placeholder="0,00"
                    className="tabular-nums"
                    value={form.kdvYuzde10}
                    onChange={(e) => updateField("kdvYuzde10", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kdvYuzde20">%20 KDV (TL)</Label>
                  <Input
                    id="kdvYuzde20"
                    placeholder="0,00"
                    className="tabular-nums"
                    value={form.kdvYuzde20}
                    onChange={(e) => updateField("kdvYuzde20", e.target.value)}
                  />
                </div>
              </div>

              {/* Özet Matrah / KDV çubuğu */}
              <div className="flex flex-wrap items-center justify-between rounded-lg border bg-muted/40 p-3 text-xs">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground">KDV Hariç Matrah:</span>
                  <div className="font-semibold tabular-nums text-foreground">{formatTL(matrah)}</div>
                </div>
                <div className="space-y-0.5 text-right">
                  <span className="text-muted-foreground">Toplam KDV:</span>
                  <div className="font-semibold tabular-nums text-foreground">{formatTL(totalKdv)}</div>
                </div>
                <div className="space-y-0.5 text-right">
                  <span className="text-muted-foreground">Genel Toplam:</span>
                  <div className="font-semibold tabular-nums text-foreground">{formatTL(totalAmount)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ek Bilgiler */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Ek Bilgiler</CardTitle>
              <CardDescription>Fiş no, vergi kimlik numarası, etiket ve notlar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fisNo">Fiş / Belge No</Label>
                  <Input
                    id="fisNo"
                    placeholder="Örn: 0042 veya ABC2026..."
                    value={form.fisNo}
                    onChange={(e) => updateField("fisNo", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vkn">VKN / TCKN</Label>
                  <Input
                    id="vkn"
                    placeholder="10 veya 11 haneli numara"
                    value={form.vkn}
                    onChange={(e) => updateField("vkn", e.target.value)}
                    maxLength={11}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="etiketler">Etiketler</Label>
                <Input
                  id="etiketler"
                  placeholder="Virgülle ayırın: yemek, temsil, yazılım"
                  value={form.etiketler}
                  onChange={(e) => updateField("etiketler", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notlar">Notlar</Label>
                <Textarea
                  id="notlar"
                  placeholder="Fişle ilgili ek açıklamalar..."
                  rows={3}
                  value={form.notlar}
                  onChange={(e) => updateField("notlar", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Uyarılar */}
          {warnings.length > 0 && (
            <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                Dikkat Edilmesi Gerekenler
              </div>
              <ul className="list-inside list-disc space-y-1 pl-1">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sağ 1 kolon: Görsel / Fotoğraf Yükleme ve Önizleme */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Fiş Fotoğrafı</CardTitle>
              <CardDescription>
                {previewUrl || existingImageUrl
                  ? "Fişin taranmış görüntüsü."
                  : "İsteğe bağlı fiş fotoğrafı yükleyebilirsiniz."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              {/* Görsel Önizleme Alanı */}
              {previewUrl || existingImageUrl ? (
                <div className="space-y-3">
                  <div className="relative flex aspect-3/4 w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl ?? existingImageUrl ?? ""}
                      alt="Fiş görseli"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="size-4" />
                      Değiştir
                    </Button>
                    {previewUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleClearPhoto}
                        title="Yeni seçimi kaldır"
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-3/4 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <Upload className="size-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Fotoğraf Yükle</p>
                    <p className="text-xs text-muted-foreground">Tıklayın veya fotoğraf dosyasını seçin</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    JPG, PNG
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Silme Onay Penceresi */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fiş silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu fiş Son Silinenler&apos;e taşınacaktır. 30 gün içinde çöp kutusundan geri alabilirsiniz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? "Siliniyor…" : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
