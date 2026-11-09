import { DEFAULT_ANUBIS_OPTIONS, validateAnubisOptions } from "./anubis-options";
import { getSetting } from "./settings";
import type { AnubisStatus } from "./anubis-policy";

export async function getAnubisStatus(): Promise<AnubisStatus> {
  const domain = process.env.ANUBIS_PROTECTED_DOMAIN || null;
  if (!domain) return { available: false, enabled: false, domain: null };
  const settings = await getSetting<{ enabled?: boolean; options?: unknown }>("anubis");
  return { available: Boolean(domain), enabled: Boolean(domain) && settings?.enabled !== false, domain, options: validateAnubisOptions(settings?.options ?? DEFAULT_ANUBIS_OPTIONS), configurable: Boolean(process.env.ANUBIS_CONTROL_PATH) };
}
