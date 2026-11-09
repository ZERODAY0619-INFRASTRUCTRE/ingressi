"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { inAnubisScope, type AnubisStatus } from "@/src/lib/anubis-policy";

type Host = { id: number; name: string; domains: string[]; enabled: boolean; anubisEnabled?: boolean };

export function AnubisToggle({ initial, host }: { initial?: AnubisStatus; host?: Host }) {
  const router = useRouter();
  const controlId = useId();
  const [status, setStatus] = useState<AnubisStatus | null>(initial ?? null);
  const [enabled, setEnabled] = useState(host ? host.anubisEnabled !== false : initial?.enabled ?? false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (initial) {
      setStatus(initial);
      setEnabled(host ? host.anubisEnabled !== false : initial.enabled);
      return;
    }
    const controller = new AbortController();
    fetch("/api/v1/anubis", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Unable to load Anubis settings");
        const data = await response.json() as AnubisStatus;
        setStatus(data); setEnabled(host ? host.anubisEnabled !== false : data.enabled);
      })
      .catch(() => { if (!controller.signal.aborted) setError("Unable to load Anubis settings. Reload to retry."); });
    return () => controller.abort();
  }, [initial, host?.id, host?.anubisEnabled]);

  const inScope = !host || Boolean(status?.domain && host.domains.some(domain => inAnubisScope(domain, status.domain!)));
  const available = Boolean(status?.available && inScope);
  const label = host ? `Anubis for ${host.name}` : "Enable Anubis globally";
  const effective = enabled && Boolean(status?.enabled) && (!host || host.enabled);
  const note = !status ? "Loading…" : !status.available ? "Not configured for this instance"
    : !inScope ? "Outside protected domain scope"
    : host && !status.enabled ? "Paused — global protection is off"
    : host && !host.enabled ? "Paused — proxy host is disabled"
    : effective ? "Protection on" : "Protection off";

  async function change(value: boolean) {
    setPending(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/v1/anubis", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: value, ...(host ? { hostId: host.id } : {}) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to save Anubis settings");
      }
      setEnabled(value);
      if (!host && status) setStatus({ ...status, enabled: value });
      setSaved(true); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save Anubis settings"); }
    finally { setPending(false); }
  }

  return <div className={host ? "flex max-w-56 flex-col gap-1" : "flex flex-col gap-3"}>
    <div className="flex items-center gap-2">
      {host ? (
        <Switch id={controlId} aria-label={label} checked={available && enabled} disabled={!available || pending} onCheckedChange={change} />
      ) : (
        <Checkbox id={controlId} aria-label={label} checked={available && enabled} disabled={!available || pending} onCheckedChange={value => change(value === true)} />
      )}
      <Label htmlFor={controlId}>{host ? "Anubis" : label}</Label>
    </div>
    <p className="text-xs text-muted-foreground" aria-live="polite">{pending ? "Applying…" : note}{saved && !pending ? " · Saved" : ""}</p>
    {!host && <p className="text-xs text-muted-foreground leading-relaxed">
      Turning this off pauses Anubis for every proxy host in this instance. Host choices are kept and resume when enabled.
      {status?.domain && <> Protection covers direct subdomains of {status.domain}. Choose individual hosts in Proxy Hosts.</>}
    </p>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
  </div>;
}
