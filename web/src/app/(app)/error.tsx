"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { isChunkLoadError, reloadForChunkError } from "@/lib/appVersion";
import { Button, Card } from "@heroui/react";

/** Panel sayfalarının hata sınırı: eski sürüm parçası hatasında sayfayı yeniler, diğerlerinde tekrar dener. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const chunkError = isChunkLoadError(error);
  useEffect(() => {
    console.error(error);
    // Otomatik yenileme süre korumalıdır; engellenirse kullanıcı butonla yeniler
    if (chunkError) reloadForChunkError();
  }, [error, chunkError]);

  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <TriangleAlert className="size-5" />
      </div>
      <h2 className="text-base font-semibold">
        {chunkError ? "Uygulama güncellendi" : "Bu sayfa yüklenemedi"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {chunkError
          ? "Yeni sürümü yüklemek için sayfayı yenileyin."
          : "Beklenmeyen bir hata oluştu. Tekrar deneyebilirsiniz."}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        {chunkError ? (
          <Button size="sm" onPress={() => window.location.reload()}>
            <RefreshCw className="size-4" /> Sayfayı Yenile
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onPress={() => window.location.reload()}>
              Sayfayı Yenile
            </Button>
            <Button size="sm" onPress={() => retry()}>
              <RefreshCw className="size-4" /> Tekrar Dene
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
