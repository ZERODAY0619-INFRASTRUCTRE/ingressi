import assert from "node:assert/strict";
import { buildAnubisGate } from "../../src/lib/caddy-anubis";
assert.equal(buildAnubisGate(undefined), null);
assert.equal(buildAnubisGate(""), null);
const gate = buildAnubisGate("example.test")!;
assert.ok(gate.routes.length > 0);
assert.deepEqual(gate.successServer.listen, ["127.0.0.1:8924"]);
console.log("PASS: internal profile disables Anubis; public profile enables its private responder");
