"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { msUntilBangkokMidnight } from "@/lib/roster-engine";

const TABLES = ["app_config", "holidays", "cycle_swaps"] as const;

/**
 * Keeps an open page fresh without a manual reload:
 *  - re-fetches when the admin changes config / holidays / swaps (Supabase Realtime)
 *  - re-fetches at Bangkok midnight, so the day rolls over while the tab stays open
 *  - re-fetches when the tab becomes visible again (phones suspend background timers)
 */
export function RealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 300);
    };

    // midnight rollover
    let midnight: ReturnType<typeof setTimeout>;
    const schedule = () => {
      midnight = setTimeout(() => {
        router.refresh();
        schedule();
      }, msUntilBangkokMidnight() + 1000);
    };
    schedule();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    // realtime (optional: skipped if env vars are missing)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
    const channel = supabase?.channel("roster-changes");
    if (supabase && channel) {
      for (const table of TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
      }
      channel.subscribe();
    }

    return () => {
      clearTimeout(debounce);
      clearTimeout(midnight);
      document.removeEventListener("visibilitychange", onVisible);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
