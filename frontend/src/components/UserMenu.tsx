"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, clearToken, getToken } from "@/lib/api";
import type { User } from "@/lib/types";

/** Shows the signed-in admin + sign-out, or a "Sign in" link. */
export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setChecked(true);
      return;
    }
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setChecked(true));
  }, [pathname]);

  // Public pages manage their own chrome.
  if (pathname?.startsWith("/share")) return null;
  if (!checked) return null;

  if (!user) {
    if (pathname?.startsWith("/login")) return null;
    return (
      <button
        onClick={() => router.push("/login")}
        className="inline-flex items-center gap-1 rounded-sm bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
      >
        Sign in <span aria-hidden>→</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden font-mono text-[11px] uppercase tracking-widest text-muted-foreground sm:inline" title={user.email}>
        {user.name}
      </span>
      <button
        onClick={() => {
          clearToken();
          router.push("/login");
        }}
        className="text-sm text-muted-foreground hover:text-foreground transition"
      >
        Sign out
      </button>
    </div>
  );
}
