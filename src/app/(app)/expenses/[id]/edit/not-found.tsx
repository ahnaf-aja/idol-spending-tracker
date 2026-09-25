import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shown for /expenses/<id> that does not exist OR belongs to another user:
 * both cases answer 404 so ownership is never leaked (requirement 39).
 */
export default function ExpenseNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <div className="bg-muted text-muted-foreground mb-4 flex size-14 items-center justify-center rounded-2xl">
        <SearchX className="size-6" />
      </div>
      <h1 className="text-lg font-bold">Transaksi tidak ditemukan</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Transaksi ini tidak ada, sudah dihapus, atau bukan milik akun kamu.
      </p>
      <Button asChild className="mt-5">
        <Link href="/history">Kembali ke History</Link>
      </Button>
    </div>
  );
}
