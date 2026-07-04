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
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Sign in
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs text-slate-500 sm:inline" title={user.email}>
        {user.name}
      </span>
      <button
        onClick={() => {
          clearToken();
          router.push("/login");
        }}
        className="text-sm text-slate-500 hover:text-brand-600"
      >
        Sign out
      </button>
    </div>
  );
}
