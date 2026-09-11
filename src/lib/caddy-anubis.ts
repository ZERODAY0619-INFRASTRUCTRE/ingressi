/**
 * Same-origin Anubis gate. Only the private success responder's HTTP 204 lets
 * Caddy continue with the ORIGINAL request, including body, TLS and client IP.
 * Challenge pages (HTTP 200), denials and errors are returned to the client.
 * Keep this before every managed route so custom locations cannot bypass it.
 */
export function buildAnubisGate(domain: string | undefined) {
  if (!domain) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) {
    throw new Error("Invalid ANUBIS_PROTECTED_DOMAIN");
  }
  // A host matcher would make Caddy auto-manage a new wildcard certificate.
  // CEL matches the same one-label scope without changing TLS subjects.
  const hostPattern = `^[^.]+[.]${domain.replaceAll(".", "[.]")}[.]?$`;
  const expression = `{http.request.host}.lowerAscii().matches(${JSON.stringify(hostPattern)})`;
  const proxy = () => ({
    handler: "reverse_proxy",
    upstreams: [{ dial: "127.0.0.1:8923" }],
    transport: { protocol: "http", dial_timeout: 3_000_000_000, response_header_timeout: 15_000_000_000 },
    headers: { request: { set: {
      "X-Real-IP": ["{http.vars.client_ip}"],
      "X-Http-Version": ["{http.request.proto}"],
      "X-Forwarded-For": ["{http.vars.client_ip}"],
      "X-Forwarded-Host": ["{http.request.host}"],
      "X-Forwarded-Proto": ["{http.request.scheme}"],
    }, delete: ["Forwarded", "X-Anubis-Status", "X-Anubis-Rule", "X-Anubis-Action"] } },
  });
  return {
    routes: [
      {
        match: [{ expression, protocol: "http" }],
        handle: [{ handler: "static_response", status_code: 308,
          headers: { Location: ["https://{http.request.host}{http.request.uri}"] } }],
        terminal: true,
      },
      {
        match: [{ expression, path: ["/.within.website/x/cmd/anubis/*", "/.within.website/x/xess/*"] }],
        handle: [proxy()],
        terminal: true,
      },
      {
        match: [{ expression }],
        handle: [{
          ...proxy(),
          // Like forward_auth, clone as GET so the service retains the body.
          // Preserve the original URI so challenges return to the same URL.
          rewrite: { method: "GET" },
          handle_response: [{
            match: { status_code: [204], headers: { "X-Cpm-Anubis-Verified": ["yes"] } },
            routes: [{ handle: [{ handler: "headers", response: { set: { "X-Anubis-Gate": ["passed"] } } }] }],
          }],
        }],
      },
    ],
    successServer: {
      listen: ["127.0.0.1:8924"],
      automatic_https: { disable: true },
      routes: [{ handle: [{ handler: "static_response", status_code: 204,
        headers: { "X-Cpm-Anubis-Verified": ["yes"] } }] }],
    },
  };
}
