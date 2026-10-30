"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(session ? "/fisler/" : "/login/");
  }, [loading, session, router]);
  return null;
}
