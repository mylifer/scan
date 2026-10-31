"use client";

import { categoryLabel } from "@shared/lib/categories";
import { KATEGORILER } from "@shared/types/receipt";
import {
  Check,
  Edit2,
  FolderPlus,
  Loader2,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addCustomCategory,
  deleteCustomCategory,
  fetchCategoryCounts,
  fetchCustomCategories,
  renameCustomCategory,
} from "@/lib/categories";

export function CategoriesView() {
  const [customList, setCustomList] = useState<string[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  // Yeni kategori ekleme formu
  const [newCatName, setNewCatName] = useState("");
  const [adding, setAdding] = useState(false);

  // Düzenleme durumu
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Silme durumu
  const [deletingCat, setDeletingCat] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = () => {
    void Promise.all([fetchCustomCategories(), fetchCategoryCounts()])
      .then(([customs, countsMap]) => {
        setCustomList(customs);
        setCounts(countsMap);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Kategoriler yüklenemedi.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setAdding(true);
    try {
      const added = await addCustomCategory(newCatName.trim());
      setNewCatName("");
      toast.success(`"${added}" kategorisi eklendi.`);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kategori eklenemedi.");
    } finally {
      setAdding(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !editName.trim()) return;

    setSavingEdit(true);
    try {
      const count = await renameCustomCategory(editingCat, editName.trim());
      toast.success(`Kategori güncellendi (${count} fiş taşındı).`);
      setEditingCat(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kategori güncellenemedi.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCat) return;

    setDeleting(true);
    try {
      const moved = await deleteCustomCategory(deletingCat, "diğer");
      toast.success(`"${deletingCat}" silindi (${moved} fiş "diğer" kategorisine aktarıldı).`);
      setDeletingCat(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kategori silinemedi.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Üst Başlık */}
      <PageHeader
        title="Kategoriler"
        description="Fişlerinizi sınıflandırmak için hazır kategorileri inceleyin veya işletmenize özel yeni kategoriler oluşturun."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sol 2 Kolon: Özel Kategoriler Yönetimi */}
        <div className="space-y-6 lg:col-span-2">
          {/* Yeni Kategori Ekleme Kartı */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="size-4 text-primary" />
                <CardTitle className="text-base font-semibold">Yeni Kategori Ekle</CardTitle>
              </div>
              <CardDescription>İşletmenizin gider kalemlerine uygun özel bir kategori tanımlayın.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <Input
                  placeholder="Kategori adı (Örn: Dijital Reklam, Ofis İkramı, Danışmanlık)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  disabled={adding}
                  className="flex-1"
                />
                <Button type="submit" disabled={adding || !newCatName.trim()} className="gap-1.5 shrink-0">
                  {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Kategori Ekle
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Tanımlı Özel Kategoriler Listesi */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Özel Kategorileriniz</CardTitle>
              <CardDescription>
                Sizin eklediğiniz kategoriler. Düzenleyebilir veya silebilirsiniz (silinen kategorideki fişler &quot;diğer&quot;e aktarılır).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : customList.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Henüz özel bir kategori tanımlamadınız. Yukarıdaki formdan ekleyebilirsiniz.
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {customList.map((cat) => {
                    const count = counts.get(cat) ?? 0;
                    return (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                          <Tag className="size-4 text-primary shrink-0" />
                          <span className="font-semibold text-foreground text-sm truncate">{categoryLabel(cat)}</span>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {count} fiş
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Düzenle"
                            onClick={() => {
                              setEditingCat(cat);
                              setEditName(cat);
                            }}
                          >
                            <Edit2 className="size-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Sil"
                            onClick={() => setDeletingCat(cat)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sağ Kolon: Hazır Sistem Kategorileri */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Hazır Sistem Kategorileri</CardTitle>
              <CardDescription>Fiş Tarayıcı ile birlikte gelen 25 adet standart muhasebe kategorisi.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {KATEGORILER.map((cat) => {
                  const count = counts.get(cat) ?? 0;
                  return (
                    <Badge
                      key={cat}
                      variant="outline"
                      className="flex items-center gap-1.5 py-1 px-2.5 text-xs text-foreground"
                    >
                      <span>{categoryLabel(cat)}</span>
                      {count > 0 && (
                        <span className="tabular-nums text-[10px] text-muted-foreground">
                          ({count})
                        </span>
                      )}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Düzenleme Dialogu */}
      <Dialog open={Boolean(editingCat)} onOpenChange={(open) => !open && setEditingCat(null)}>
        <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kategori Adını Düzenle</DialogTitle>
            <DialogDescription>
              Kategori adı değiştirildiğinde bu kategoriye ait mevcut tüm fişler otomatik olarak yeni ada taşınacaktır.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Yeni Kategori Adı</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingCat(null)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={savingEdit || !editName.trim()} className="gap-1.5">
                {savingEdit ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Silme Onay Dialogu */}
      <AlertDialog open={Boolean(deletingCat)} onOpenChange={(open) => !open && setDeletingCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>&quot;{deletingCat}&quot; kategorisi silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu kategori silindiğinde, bu kategoride bulunan tüm fişleriniz güvenli bir şekilde &quot;diğer&quot; kategorisine aktarılacaktır. Fişleriniz silinmez.
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
              {deleting ? "Siliniyor…" : "Kategoriyi Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
