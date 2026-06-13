"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RedirectToBrowseTask() {
  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    if (id) {
      router.replace(`/browse/${id}`);
    }
  }, [id, router]);

  return null;
}
