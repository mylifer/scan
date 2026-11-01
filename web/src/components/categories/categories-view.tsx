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
import { AlertDialog, Button, Card, Chip, Input, Label, Modal, Skeleton, toast } from "@heroui/react";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryBadge } from "@/components/category-badge";
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
        toast.danger(err instanceof Error ? err.message : "Kategoriler yüklenemedi.");
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
      toast.danger(err instanceof Error ? err.message : "Kategori eklenemedi.");
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
      toast.danger(err instanceof Error ? err.message : "Kategori güncellenemedi.");
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
      toast.danger(err instanceof Error ? err.message : "Kategori silinemedi.");
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
            <Card.Header>
              <div className="flex items-center gap-2">
                <FolderPlus className="size-4 text-accent" />
                <Card.Title>Yeni Kategori Ekle</Card.Title>
              </div>
              <Card.Description>İşletmenizin gider kalemlerine uygun özel bir kategori tanımlayın.</Card.Description>
            </Card.Header>
            <Card.Content>
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <Input fullWidth
                  placeholder="Kategori adı (Örn: Dijital Reklam, Ofis İkramı, Danışmanlık)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  disabled={adding}
                  className="flex-1"
                />
                <Button size="sm" type="submit" isDisabled={adding || !newCatName.trim()} className="gap-1.5 shrink-0">
                  {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Kategori Ekle
                </Button>
              </form>
            </Card.Content>
          </Card>

          {/* Tanımlı Özel Kategoriler Listesi */}
          <Card>
            <Card.Header>
              <Card.Title>Özel Kategorileriniz</Card.Title>
              <Card.Description>
                Sizin eklediğiniz kategoriler. Düzenleyebilir veya silebilirsiniz (silinen kategorideki fişler &quot;diğer&quot;e aktarılır).
              </Card.Description>
            </Card.Header>
            <Card.Content>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : customList.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted">
                  Henüz özel bir kategori tanımlamadınız. Yukarıdaki formdan ekleyebilirsiniz.
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {customList.map((cat) => {
                    const count = counts.get(cat) ?? 0;
                    return (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-3 transition-colors hover:bg-default/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                          <Tag className="size-4 text-accent shrink-0" />
                          <span className="font-semibold text-foreground text-sm truncate">{categoryLabel(cat)}</span>
                          <Chip size="sm" variant="soft" className="shrink-0">
                            {count} fiş
                          </Chip>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm" isIconOnly
                            aria-label="Düzenle"
                            onPress={() => {
                              setEditingCat(cat);
                              setEditName(cat);
                            }}
                          >
                            <Edit2 className="size-3.5 text-muted" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm" isIconOnly
                            aria-label="Sil"
                            onPress={() => setDeletingCat(cat)}
                          >
                            <Trash2 className="size-3.5 text-danger" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card.Content>
          </Card>
        </div>

        {/* Sağ Kolon: Hazır Sistem Kategorileri */}
        <div className="space-y-6">
          <Card>
            <Card.Header>
              <Card.Title>Hazır Sistem Kategorileri</Card.Title>
              <Card.Description>Fiş Tarayıcı ile birlikte gelen 25 adet standart muhasebe kategorisi.</Card.Description>
            </Card.Header>
            <Card.Content>
              <div className="flex flex-wrap gap-2">
                {KATEGORILER.map((cat) => {
                  const count = counts.get(cat) ?? 0;
                  return (
                    <div key={cat} className="inline-flex items-center gap-1.5">
                      <CategoryBadge category={cat} />
                      {count > 0 && (
                        <span className="tabular-nums text-[10px] text-muted font-semibold px-1.5 py-0.5 rounded-full bg-default border border-border/50">
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>

      {/* Düzenleme Dialogu */}
      <Modal.Backdrop isOpen={Boolean(editingCat)} onOpenChange={(open) => !open && setEditingCat(null)}>
        <Modal.Container className="sm:w-full">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Kategori Adını Düzenle</Modal.Heading>
              <p className="text-sm text-muted">
                Kategori adı değiştirildiğinde bu kategoriye ait mevcut tüm fişler otomatik olarak yeni ada taşınacaktır.
              </p>
            </Modal.Header>
            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Yeni Kategori Adı</Label>
                <Input fullWidth
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <Modal.Footer>
                <Button size="sm" type="button" variant="outline" onPress={() => setEditingCat(null)}>
                  Vazgeç
                </Button>
                <Button size="sm" type="submit" isDisabled={savingEdit || !editName.trim()} className="gap-1.5">
                  {savingEdit ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Kaydet
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Silme Onay Dialogu */}
      <AlertDialog.Backdrop isOpen={Boolean(deletingCat)} onOpenChange={(open) => !open && setDeletingCat(null)}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>&quot;{deletingCat}&quot; kategorisi silinsin mi?</AlertDialog.Heading>
              <p className="text-sm text-muted">
                Bu kategori silindiğinde, bu kategoride bulunan tüm fişleriniz güvenli bir şekilde &quot;diğer&quot; kategorisine aktarılacaktır. Fişleriniz silinmez.
              </p>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary" size="sm" isDisabled={deleting}>Vazgeç</Button>
              <Button size="sm"
                variant="danger"
                isDisabled={deleting}
                onPress={() => {
                  void handleDelete();
                }}
              >
                {deleting ? "Siliniyor…" : "Kategoriyi Sil"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
