"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/errorLog";

/** Yakalanmamış hataları ve sonuçlanamayan işlemleri app_errors'a yazar. Arayüz çizmez. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError("yakalanmamış hata", e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportError("yakalanmamış işlem hatası", e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
