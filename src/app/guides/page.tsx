"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function GuideSelectionPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      if (!supabase) {
        router.push("/login");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Redirect to age selection flow
      router.push("/guides/age-select");
    };

    void checkAuthAndRedirect();
  }, [router, supabase]);

  // Show loading state while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f3ee]">
      <div className="text-center">
        <p className="text-[#5b4d42]">Loading guide selection...</p>
      </div>
    </div>
  );
}

