import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Unknown member (or a name that belongs to another user) answers 404. */
export default function MemberNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <div className="bg-muted text-muted-foreground mb-4 flex size-14 items-center justify-center rounded-2xl">
        <SearchX className="size-6" />
      </div>
      <h1 className="text-lg font-bold">Member tidak ditemukan</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Belum ada transaksi dengan nama member ini di akun kamu.
      </p>
      <Button asChild className="mt-5">
        <Link href="/journal">Kembali ke Member Journal</Link>
      </Button>
    </div>
  );
}
