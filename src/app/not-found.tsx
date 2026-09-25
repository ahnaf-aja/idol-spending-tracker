import Link from "next/link";
import { Home, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="bg-muted text-muted-foreground mb-4 flex size-14 items-center justify-center rounded-2xl">
        <SearchX className="size-6" />
      </div>
      <h1 className="text-lg font-bold">Halaman tidak ditemukan</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Halaman yang kamu cari tidak ada, atau sudah dipindahkan.
      </p>
      <Button asChild className="mt-5">
        <Link href="/dashboard">
          <Home className="size-4" />
          Ke Dashboard
        </Link>
      </Button>
    </div>
  );
}
