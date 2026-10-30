"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ReceiptForm } from "@/components/receipts/receipt-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getReceipt } from "@/lib/receipts";
import type { ReceiptRecord } from "@shared/types/receipt";

function ReceiptDetailLoader() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [state, setState] = useState<{
    record: ReceiptRecord | null;
    loading: boolean;
    error: string | null;
  }>(() => ({
    record: null,
    loading: Boolean(id),
    error: id ? null : "Fiş kimliği belirtilmedi.",
  }));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void getReceipt(id)
      .then((data) => {
        if (!cancelled) setState({ record: data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Fiş bulunamadı.";
          setState({ record: null, loading: false, error: msg });
          toast.error(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fiş Bulunamadı" description={state.error} />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {state.error}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ReceiptForm
      key={state.record?.id ?? "loading"}
      initialRecord={state.record ?? undefined}
      loadingRecord={state.loading}
    />
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <ReceiptDetailLoader />
    </Suspense>
  );
}
