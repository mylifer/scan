"use client";

import { Check, GitMerge, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button, Card, Chip, Modal, toast } from "@heroui/react";
import { renameFirms, type FirmGroup } from "@/lib/firms";

interface FirmMergeDialogProps {
  groups: FirmGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}

export function FirmMergeDialog({
  groups,
  open,
  onOpenChange,
  onMerged,
}: FirmMergeDialogProps) {
  const [mergingIdx, setMergingIdx] = useState<number | null>(null);

  const handleMerge = async (group: FirmGroup, idx: number) => {
    setMergingIdx(idx);
    try {
      const fromNames = group.variants.map((v) => v.name);
      const count = await renameFirms(fromNames, group.suggested);
      toast.success(`${count} adet fişte firma adı "${group.suggested}" olarak birleştirildi.`);
      onMerged();
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Birleştirme başarısız.");
    } finally {
      setMergingIdx(null);
    }
  };

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Container className="sm:w-full">
        <Modal.Dialog className="flex max-h-[85vh] sm:max-w-2xl flex-col p-4 sm:p-6 overflow-hidden">
          <Modal.CloseTrigger />
          <Modal.Header className="border-b pb-4 pr-8">
            <div className="flex items-center gap-2">
              <GitMerge className="size-5 text-accent" />
              <Modal.Heading className="text-base sm:text-lg">Firma Adlarını Birleştir</Modal.Heading>
            </div>
            <p className="text-sm text-muted text-xs sm:text-sm">
              Benzer yazılan firma adları tespit edildi. Tek tıkla ortak bir ad altında toplayabilirsiniz.
            </p>
          </Modal.Header>

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-1 pt-2">
            {groups.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted">
                Birleştirilebilecek benzer firma adı bulunamadı.
              </div>
            ) : (
              groups.map((group, idx) => {
                const isMerging = mergingIdx === idx;
                return (
                  <Card key={idx} className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-muted">Önerilen Ortak Ad:</span>
                        <h4 className="font-semibold text-foreground text-sm sm:text-base break-words">
                          {group.suggested}
                        </h4>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        isDisabled={isMerging}
                        onPress={() => handleMerge(group, idx)}
                        className="shrink-0 gap-1.5"
                      >
                        {isMerging ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Birleştiriliyor…
                          </>
                        ) : (
                          <>
                            <Check className="size-3.5" />
                            Bu Adla Birleştir ({group.total} Fiş)
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-muted">Farklı Yazımlar:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {group.variants.map((v, i) => (
                          <Chip size="sm" key={i} color={v.name === group.suggested ? "accent" : "default"} variant={v.name === group.suggested ? "primary" : "secondary"} className="text-xs">
                            {v.name} ({v.count})
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
