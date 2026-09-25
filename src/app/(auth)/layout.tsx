import Link from "next/link";
import { Sparkles } from "lucide-react";

/** Shared shell for Login / Register / Forgot / Reset: centered, mobile-first. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl shadow-sm">
            <Sparkles className="size-[18px]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Idol Spending Tracker</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
        <div className="w-full max-w-[26rem] animate-rise">{children}</div>
      </main>

      <footer className="text-muted-foreground px-5 pb-6 text-center text-xs sm:px-8">
        Periode pengeluaran otomatis setiap tanggal 25 — 24 bulan berikutnya.
      </footer>
    </div>
  );
}
