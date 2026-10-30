"use client";

import { Check, GitMerge, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      toast.error(err instanceof Error ? err.message : "Birleştirme başarısız.");
    } finally {
      setMergingIdx(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="border-b pb-4 pr-8">
          <div className="flex items-center gap-2">
            <GitMerge className="size-5 text-primary" />
            <DialogTitle className="text-base sm:text-lg">Firma Adlarını Birleştir</DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Benzer yazılan firma adları tespit edildi. Tek tıkla ortak bir ad altında toplayabilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-1 pt-2">
          {groups.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Birleştirilebilecek benzer firma adı bulunamadı.
            </div>
          ) : (
            groups.map((group, idx) => {
              const isMerging = mergingIdx === idx;
              return (
                <Card key={idx} size="sm" className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-muted-foreground">Önerilen Ortak Ad:</span>
                      <h4 className="font-semibold text-foreground text-sm sm:text-base break-words">
                        {group.suggested}
                      </h4>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isMerging}
                      onClick={() => handleMerge(group, idx)}
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
                    <span className="text-xs text-muted-foreground">Farklı Yazımlar:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {group.variants.map((v, i) => (
                        <Badge key={i} variant={v.name === group.suggested ? "default" : "outline"} className="text-xs">
                          {v.name} ({v.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
