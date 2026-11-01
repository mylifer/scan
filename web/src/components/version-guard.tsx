"use client";

import { useEffect, useRef } from "react";
import { toast } from "@heroui/react";
import { APP_VERSION, isChunkLoadError, isNewVersion, reloadForChunkError, VERSION_URL } from "@/lib/appVersion";

const CHECK_INTERVAL_MS = 5 * 60_000;

/**
 * Yeni sürüm koruması: eski parça yükleme hatasında sayfayı yeniler ve yeni sürüm yayınlandığında
 * kalıcı bir "Yenile" bildirimi gösterir. Arayüz çizmez.
 */
export function VersionGuard() {
  const notified = useRef(false);

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isChunkLoadError(e.error ?? e.message)) reloadForChunkError();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkLoadError(e.reason)) reloadForChunkError();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    if (!APP_VERSION) return; // yerel geliştirmede sürüm yok

    const check = async () => {
      if (notified.current || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        if (isNewVersion(APP_VERSION, await res.json())) {
          notified.current = true;
          toast.info("Uygulamanın yeni sürümü yayınlandı.", {
            timeout: 0,
            actionProps: { children: "Yenile", onPress: () => window.location.reload() },
          });
        }
      } catch {
        // çevrimdışı vb.: sessizce geç
      }
    };

    const onVisible = () => void check();
    const timer = window.setInterval(onVisible, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
