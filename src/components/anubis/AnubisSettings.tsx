"use client";
import { useEffect, useState } from "react";
import { AnubisToggle } from "./AnubisToggle";
import { DEFAULT_ANUBIS_OPTIONS, type AnubisOptions } from "@/src/lib/anubis-options";
import type { AnubisStatus } from "@/src/lib/anubis-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormCard, FormRow } from "@/src/components/settings/SettingsForm";

export function AnubisSettings() {
  const [status, setStatus] = useState<AnubisStatus>();
  const [options, setOptions] = useState<AnubisOptions>({ ...DEFAULT_ANUBIS_OPTIONS });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/anubis", { cache: "no-store", signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error();
      const data = await r.json() as AnubisStatus;
      setStatus(data); setOptions(data.options ?? { ...DEFAULT_ANUBIS_OPTIONS });
    }).catch(() => { if (!controller.signal.aborted) setError("Unable to load Anubis settings. Reload to retry."); });
    return () => controller.abort();
  }, []);
  function change<K extends keyof AnubisOptions>(key: K, value: AnubisOptions[K]) {
    setOptions(previous => ({ ...previous, [key]: value })); setSaved(false);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError(""); setSaved(false);
    try {
      const r = await fetch("/api/v1/anubis", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ options }) });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.error || "Unable to apply Anubis settings");
      }
      setSaved(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to apply settings"); }
    finally { setPending(false); }
  }
  const disabled = !status?.configurable || pending;
  return <div className="flex flex-col gap-6">
    <FormCard>
      <FormRow label="Global protection" hint="Default bot protection for this instance.">
        {status ? <AnubisToggle initial={status} /> : <p className="text-sm text-muted-foreground" role="status">Loading Anubis settings…</p>}
      </FormRow>
    </FormCard>
    <FormCard title="Challenge and session settings">
      <form onSubmit={save} className="flex flex-col gap-3">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {saved && <Alert><AlertDescription role="status">Settings applied. Anubis is healthy.</AlertDescription></Alert>}
        {status && !status.configurable && <Alert><AlertDescription>Runtime configuration is unavailable for this instance.</AlertDescription></Alert>}
        <fieldset disabled={disabled} className="min-w-0 disabled:opacity-60">
          <FormRow label="Challenge method">
            <Select value={options.algorithm} disabled={disabled} onValueChange={value => change("algorithm", value as AnubisOptions["algorithm"])}>
              <SelectTrigger id="anubis-algorithm" aria-label="Challenge method" className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">Proof of work — fast</SelectItem>
                <SelectItem value="slow">Proof of work — slow</SelectItem>
                <SelectItem value="metarefresh">Browser refresh</SelectItem>
              </SelectContent>
            </Select>
          </FormRow>
          <FormRow label={options.algorithm === "metarefresh" ? "Refresh delay (seconds)" : "Challenge difficulty"} hint="1–8. Higher proof-of-work values require substantially more client processing.">
            <Input id="anubis-difficulty" aria-label={options.algorithm === "metarefresh" ? "Refresh delay (seconds)" : "Challenge difficulty"} className="h-8 text-sm w-32 font-mono" type="number" min={1} max={8} step={1} required value={options.difficulty} onChange={e => change("difficulty", Number(e.target.value))} />
          </FormRow>
          <FormRow label="Cookie lifetime (hours)" hint="Applies to newly issued cookies; existing cookies retain their expiry.">
            <Input id="anubis-cookie-hours" aria-label="Authentication cookie lifetime (hours)" className="h-8 text-sm w-32 font-mono" type="number" min={1} max={168} step={1} required value={options.cookieHours} onChange={e => change("cookieHours", Number(e.target.value))} />
          </FormRow>
          <FormRow label="Challenge language">
            <Select value={options.language || "auto"} disabled={disabled} onValueChange={value => change("language", value === "auto" ? "" : value as AnubisOptions["language"])}>
              <SelectTrigger id="anubis-language" aria-label="Challenge language" className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Browser preference</SelectItem>
                <SelectItem value="en">English</SelectItem><SelectItem value="ko">한국어</SelectItem><SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem><SelectItem value="fr">Français</SelectItem><SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </FormRow>
          <FormRow label="Challenge explanation">
            <div className="flex items-center gap-2">
              <Checkbox id="anubis-simplified" disabled={disabled} checked={options.simplified} onCheckedChange={value => change("simplified", value === true)} />
              <Label htmlFor="anubis-simplified">Use a simplified explanation</Label>
            </div>
          </FormRow>
          <FormRow label="Crawler indexing" hint="Asks crawlers not to index protected hosts.">
            <div className="flex items-center gap-2">
              <Checkbox id="anubis-robots" disabled={disabled} checked={options.robots} onCheckedChange={value => change("robots", value === true)} />
              <Label htmlFor="anubis-robots">Serve a restrictive robots.txt</Label>
            </div>
          </FormRow>
        </fieldset>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={disabled}>{pending ? "Applying Anubis settings…" : "Save Anubis settings"}</Button>
        </div>
      </form>
    </FormCard>
    <Alert className="border-brand/30 bg-brand-tint text-brand [&>svg]:text-brand">
      <AlertDescription>Saving briefly restarts Anubis to apply these settings. Proxy host choices are preserved.</AlertDescription>
    </Alert>
  </div>;
}
