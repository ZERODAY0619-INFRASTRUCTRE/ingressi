import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';

type Snapshot = { at: number; peers: Record<string, string> };
type Observations = { generated_at: number; snapshots: Snapshot[] };
let cache: Observations | null = null;
let loadedAt = 0;

export function observedPublicIp(ip: string, ts: number, data: Observations | null, now: number): string | null {
  const octets = ip.split('.').map(Number);
  const tailnet = isIP(ip) === 4 && octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
  if (!tailnet || !data || !Number.isFinite(ts) || now - data.generated_at > 30 || data.generated_at > now + 2) return null;
  const sample = data.snapshots.filter(s => s.at <= ts && ts - s.at <= 20).sort((a,b) => b.at-a.at)[0];
  // The host collector validates global unicast addresses; only its read-only file is trusted.
  const endpoint = sample?.peers[ip];
  return endpoint && isIP(endpoint) ? endpoint : null;
}

export function resolveAnalyticsGeo(ip: string, ts: number, lookup: (ip: string) => string | null) {
  const direct = lookup(ip);
  const normal = { country_code: direct, observed_public_ip: null as string | null, geoip_source: direct ? 'client_ip' : 'unknown' };
  const file = process.env.TAILSCALE_GEOIP_OBSERVATIONS;
  if (!file || direct) return normal;
  const now = Math.floor(Date.now() / 1000);
  if (now !== loadedAt) {
    loadedAt = now;
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'));
      cache = Number.isFinite(parsed.generated_at) && Array.isArray(parsed.snapshots) ? parsed : null;
    } catch { cache = null; }
  }
  try {
    const endpoint = observedPublicIp(ip, ts, cache, now);
    if (!endpoint) return normal;
    return { country_code: lookup(endpoint), observed_public_ip: endpoint, geoip_source: 'tailscale_endpoint_estimate' };
  } catch { return normal; }
}
