"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TextToImagePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/generate-image");
  }, [router]);

  return null;
}
