"use client";

import { Toast } from "@heroui/react";

/** Uygulama genelindeki HeroUI bildirim bölgesi (kök layout'ta bir kez). */
export function AppToastProvider() {
  return <Toast.Provider placement="bottom end" width={380} />;
}
