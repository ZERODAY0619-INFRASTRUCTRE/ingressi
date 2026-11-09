import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getSetting } from "./settings";
import { DEFAULT_ANUBIS_OPTIONS, validateAnubisOptions } from "./anubis-options";

export async function syncAnubisRuntime() {
  const directory = process.env.ANUBIS_CONTROL_PATH;
  if (!directory || !process.env.ANUBIS_PROTECTED_DOMAIN) return;
  const stored = await getSetting<{ options?: unknown }>("anubis");
  const options = validateAnubisOptions(stored?.options ?? DEFAULT_ANUBIS_OPTIONS);
  const hash = createHash("sha256").update(JSON.stringify(options)).digest("hex");
  await mkdir(directory, { recursive: true });
  const desired = JSON.stringify({ hash, options });
  const path = join(directory, "desired.json");
  if (await readFile(path, "utf8").catch(() => "") !== desired) {
    const temp = join(directory, `desired-${randomUUID()}.tmp`);
    await writeFile(temp, desired, { mode: 0o600 });
    await rename(temp, path);
  }
  // Only acknowledge success after the supervisor reports a healthy replacement.
  for (let attempt = 0; attempt < 40; attempt++) {
    const raw = await readFile(join(directory, "status.json"), "utf8").catch(() => "{}");
    const status = JSON.parse(raw) as { hash?: string; state?: string; at?: number };
    if (status.hash === hash && status.at && Date.now() - status.at < 15000) {
      if (status.state === "ready") return;
      if (status.state === "error") throw new Error("Anubis rejected runtime settings");
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Timed out applying Anubis runtime settings");
}
