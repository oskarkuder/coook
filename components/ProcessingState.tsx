"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/icons";

/**
 * A recipe row is written before the extraction finishes. If the user lands
 * here from history mid-run, poll until the row flips to ready or failed.
 */
export function ProcessingState() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="page">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <Spinner className="h-5 w-5" />
          <p className="text-[17px] font-medium">Reading the video…</p>
        </div>
        <p className="meta mt-3">
          This page updates by itself as soon as the recipe is ready.
        </p>
      </div>
    </div>
  );
}
