"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Error boundary for the authenticated area (requirement 46). */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error.message);
  }, [error]);

  const isUnauthorized = error.message === "UNAUTHORIZED";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="bg-destructive/12 text-destructive mb-4 flex size-14 items-center justify-center rounded-2xl">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="text-lg font-bold">
        {isUnauthorized ? "Sesi kamu sudah berakhir" : "Terjadi kesalahan"}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {isUnauthorized
          ? "Silakan login kembali untuk melanjutkan."
          : "Kami tidak bisa memuat data ini. Coba lagi sebentar lagi."}
      </p>
      <Button className="mt-5" onClick={() => (isUnauthorized ? (window.location.href = "/login") : reset())}>
        <RotateCcw className="size-4" />
        {isUnauthorized ? "Login" : "Coba lagi"}
      </Button>
    </div>
  );
}
