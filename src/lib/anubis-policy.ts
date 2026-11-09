import type { AnubisOptions } from "./anubis-options";
import { hostMatchesPattern } from "./host-pattern-priority";

export type AnubisHostPolicy = { domains: string[]; enabled: boolean; anubisEnabled?: boolean };
export type AnubisStatus = { available: boolean; enabled: boolean; domain: string | null; options?: AnubisOptions; configurable?: boolean };

export function inAnubisScope(domain: string, scope: string): boolean {
  return hostMatchesPattern(domain, `*.${scope}`);
}

/** Exact hosts override wildcard hosts, as they do in Caddy route ordering.
 * Conflicting duplicate names remain protected if either host enables protection.
 * Unmanaged names retain the deployment's original wildcard protection.
 */
export function anubisExpression(scope: string, hosts: AnubisHostPolicy[]): string {
  const pattern = `^[^.]+[.]${scope.replaceAll(".", "[.]")}[.]?$`;
  const base = `{http.request.host}.lowerAscii().matches(${JSON.stringify(pattern)})`;
  const choices = new Map<string, boolean>();
  for (const host of hosts) {
    if (!host.enabled) continue;
    for (const value of host.domains) {
      const domain = value.trim().toLowerCase().replace(/\.$/, "");
      if (!inAnubisScope(domain, scope)) continue;
      choices.set(domain, (choices.get(domain) ?? false) || host.anubisEnabled !== false);
    }
  }
  const wildcardEnabled = choices.get(`*.${scope}`) !== false;
  const exact = [...choices].filter(([domain, enabled]) => !domain.startsWith("*.") && enabled !== wildcardEnabled);
  if (!exact.length) return wildcardEnabled ? base : "false";
  // Compare literal hostnames through a CEL list; no user value becomes code.
  const names = exact.flatMap(([domain]) => [domain, domain + "."]);
  const match = `{http.request.host}.lowerAscii() in ${JSON.stringify(names)}`;
  return `(${base}) && (${wildcardEnabled ? `!(${match})` : match})`;
}
