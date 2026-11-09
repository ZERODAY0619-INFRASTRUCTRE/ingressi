import assert from "node:assert/strict";
import { buildAuthentikUpstream } from "../../src/lib/caddy-authentik";

assert.deepEqual(buildAuthentikUpstream("https://sso.example.com"), {
  upstreams: [{ dial: "sso.example.com:443" }],
  transport: { protocol: "http", tls: { server_name: "sso.example.com" } },
});
assert.deepEqual(buildAuthentikUpstream("https://sso.example.com:9443/"), {
  upstreams: [{ dial: "sso.example.com:9443" }],
  transport: { protocol: "http", tls: { server_name: "sso.example.com" } },
});
assert.deepEqual(buildAuthentikUpstream("http://authentik-server:9000"), {
  upstreams: [{ dial: "authentik-server:9000" }],
});
assert.deepEqual(buildAuthentikUpstream("authentik-server:9000"), {
  upstreams: [{ dial: "authentik-server:9000" }],
});
assert.deepEqual(buildAuthentikUpstream("https://[::1]:9443"), {
  upstreams: [{ dial: "[::1]:9443" }],
  transport: { protocol: "http", tls: { server_name: "::1" } },
});
console.log("PASS: Authentik HTTP/HTTPS ports, TLS identity, and IPv6");
