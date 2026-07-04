"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import QRCode from "qrcode";
import { api, fetcher } from "@/lib/api";
import type { ShareLink } from "@/lib/types";
import { Card, Button } from "@/components/ui";

/** Create / list / revoke parent share links for one timetable, with QR codes. */
export function ShareLinksCard({ sid, tid }: { sid: number; tid: number }) {
  const { data: links, mutate } = useSWR<ShareLink[]>(
    `/schools/${sid}/timetables/${tid}/share-links`,
    fetcher
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api.createShareLink(sid, tid);
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create link");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(linkId: number) {
    if (!confirm("Revoke this link? Anyone using it will lose access immediately.")) return;
    try {
      await api.revokeShareLink(sid, tid, linkId);
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke link");
    }
  }

  return (
    <Card className="no-print space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Share with parents</h2>
          <p className="text-sm text-slate-500">
            Read-only class timetable — no staff names. Revoke a link any time to cut access.
          </p>
        </div>
        <Button onClick={create} disabled={busy}>
          {busy ? "Creating…" : "+ New share link"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {links && links.length === 0 && (
        <p className="rounded-lg border px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700">
          No active links. Create one to share this timetable with parents.
        </p>
      )}

      <div className="space-y-3">
        {(links ?? []).map((link) => (
          <ShareLinkRow key={link.id} link={link} onRevoke={() => revoke(link.id)} />
        ))}
      </div>
    </Card>
  );
}

function ShareLinkRow({ link, onRevoke }: { link: ShareLink; onRevoke: () => void }) {
  const [showQr, setShowQr] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined" ? `${window.location.origin}/share/${link.token}` : "";

  useEffect(() => {
    if (showQr && url && !qr) {
      QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setQr).catch(() => setQr(null));
    }
  }, [showQr, url, qr]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
          {url}
        </code>
        <Button variant="ghost" className="px-3 py-1.5" onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </Button>
        <Button variant="ghost" className="px-3 py-1.5" onClick={() => setShowQr((v) => !v)}>
          {showQr ? "Hide QR" : "QR"}
        </Button>
        <Button variant="danger" className="px-3 py-1.5" onClick={onRevoke}>
          Revoke
        </Button>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Created {new Date(link.created_at).toLocaleString()}
      </p>
      {showQr && (
        <div className="mt-3 flex justify-center rounded-lg bg-white p-4">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code for the parent share link" width={220} height={220} />
          ) : (
            <p className="text-sm text-slate-500">Generating…</p>
          )}
        </div>
      )}
    </div>
  );
}
