"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RedirectToBrowseAiAnalysis() {
  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    if (id) {
      router.replace(`/browse/${id}/ai-analysis`);
    }
  }, [id, router]);

  return null;
}
