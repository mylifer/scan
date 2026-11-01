"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { isChunkLoadError, reloadForChunkError } from "@/lib/appVersion";

/** Panel sayfalarının hata sınırı: eski sürüm parçası hatasında sayfayı yeniler, diğerlerinde tekrar dener. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const chunkError = isChunkLoadError(error);
  useEffect(() => {
    console.error(error);
    // Otomatik yenileme süre korumalıdır; engellenirse kullanıcı butonla yeniler
    if (chunkError) reloadForChunkError();
  }, [error, chunkError]);

  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border/80 dark:border-white/[0.05] bg-card/75 backdrop-blur-xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.03)] text-center">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <TriangleAlert className="size-5" />
      </div>
      <h2 className="text-base font-semibold">
        {chunkError ? "Uygulama güncellendi" : "Bu sayfa yüklenemedi"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {chunkError
          ? "Yeni sürümü yüklemek için sayfayı yenileyin."
          : "Beklenmeyen bir hata oluştu. Tekrar deneyebilirsiniz."}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        {chunkError ? (
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" /> Sayfayı Yenile
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Sayfayı Yenile
            </Button>
            <Button onClick={() => retry()}>
              <RefreshCw className="size-4" /> Tekrar Dene
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
