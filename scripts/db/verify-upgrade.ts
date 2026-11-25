/** Verifies a disposable migrated database without disclosing stored secrets. */
import { X509Certificate, createPrivateKey, createPublicKey } from "node:crypto";
import { writeFileSync } from "node:fs";
import { sqlite } from "../../src/lib/db";
import { runDatabaseStartup } from "../../src/lib/db/startup";
import { listCertificates } from "../../src/lib/models/certificates";
import { buildCaddyDocument } from "../../src/lib/caddy";

await runDatabaseStartup();
const integrity = sqlite.query("PRAGMA integrity_check").get() as { integrity_check: string };
if (integrity.integrity_check !== "ok") throw new Error("Database integrity check failed");
const counts = Object.fromEntries(["users", "proxy_hosts", "certificates", "settings", "access_lists"].map(table => [table, (sqlite.query(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count]));
const certificates = await listCertificates();
const certificateChecks = certificates.map(certificate => {
  if (!certificate.certificatePem || !certificate.privateKeyPem) return { id: certificate.id, type: certificate.type };
  const parsed = new X509Certificate(certificate.certificatePem);
  const publicKey = createPublicKey(createPrivateKey(certificate.privateKeyPem)).export({ type: "spki", format: "pem" });
  if (publicKey !== parsed.publicKey.export({ type: "spki", format: "pem" })) throw new Error(`Certificate ${certificate.id} key mismatch`);
  return { id: certificate.id, serial: parsed.serialNumber, validTo: parsed.validTo, keyMatches: true };
});
const document = await buildCaddyDocument();
writeFileSync("/app/data/verified-caddy.json", JSON.stringify(document), { mode: 0o600 });
console.log(JSON.stringify({ integrity: "ok", counts, certificates: certificateChecks, servers: Object.keys(document.apps?.http?.servers ?? {}) }));
process.exit(0);
