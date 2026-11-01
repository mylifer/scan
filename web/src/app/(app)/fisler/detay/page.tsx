"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Skeleton, toast } from "@heroui/react";
import { ReceiptForm } from "@/components/receipts/receipt-form";
import { PageHeader } from "@/components/layout/page-header";
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
          toast.danger(msg);
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
          <Card.Content className="text-center text-sm text-muted">
            {state.error}
          </Card.Content>
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
            <Card.Content className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </Card.Content>
          </Card>
        </div>
      }
    >
      <ReceiptDetailLoader />
    </Suspense>
  );
}
