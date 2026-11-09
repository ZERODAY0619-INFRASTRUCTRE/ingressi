import { anubisExpression, type AnubisHostPolicy } from "./anubis-policy";

/**
 * Same-origin Anubis gate. Only the private success responder's HTTP 204 lets
 * Caddy continue with the ORIGINAL request, including body, TLS and client IP.
 * Challenge pages (HTTP 200), denials and errors are returned to the client.
 * Keep this before every managed route so custom locations cannot bypass it.
 */
export function buildAnubisGate(domain: string | undefined, options: {
  enabled?: boolean; hosts?: AnubisHostPolicy[]; roamingHost?: string; roamingHosts?: string[]; apiHosts?: string[];
} = {}) {
  if (!domain || options.enabled === false) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) {
    throw new Error("Invalid ANUBIS_PROTECTED_DOMAIN");
  }
  // A host matcher would make Caddy auto-manage a new wildcard certificate.
  // CEL matches the same one-label scope without changing TLS subjects.
  const expression = anubisExpression(domain, options.hosts ?? []);
  const roamingHost = options.roamingHost ?? process.env.ANUBIS_ROAMING_HOST;
  const roamingHosts = [...new Set([
    ...(roamingHost ? [roamingHost] : []),
    ...(options.roamingHosts ?? process.env.ANUBIS_ROAMING_HOSTS?.split(",").map(value => value.trim()).filter(Boolean) ?? []),
  ])];
  const apiHosts = options.apiHosts ?? process.env.ANUBIS_API_HOSTS?.split(",").map(value => value.trim()).filter(Boolean) ?? [];
  for (const host of [...roamingHosts, ...apiHosts]) {
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) ||
        !host.endsWith(`.${domain}`) || host.slice(0, -(domain.length + 1)).includes(".")) {
      throw new Error("Invalid ANUBIS_ROAMING_HOST or ANUBIS_API_HOSTS");
    }
  }
  const apiExpression = `{http.request.host}.lowerAscii() in ${JSON.stringify(apiHosts.flatMap(host => [host, `${host}.`]))}`;
  // Private Relay can change the address between HTTP and WebSocket requests.
  // Only configured hosts use a browser binding; all others retain their IP binding.
  const binding = () => roamingHosts.length ? [{
    handler: "map",
    source: "{http.request.host}|{http.request.header.User-Agent}",
    destinations: ["{cpm.anubis_binding}"],
    mappings: roamingHosts.map(host => ({
      input_regexp: `(?i)^${host.replaceAll(".", "[.]")}[.]?\\|(.*)$`,
      // Preserve existing SSO cookies when adding another roaming host.
      outputs: [host === roamingHost ? "sso:${1}" : `${host}:\${1}`],
    })),
    defaults: ["{http.vars.client_ip}"],
  }] : [];
  const proxy = () => ({
    handler: "reverse_proxy",
    upstreams: [{ dial: "127.0.0.1:8923" }],
    transport: { protocol: "http", dial_timeout: 3_000_000_000, response_header_timeout: 15_000_000_000 },
    headers: { request: { set: {
      ...(roamingHosts.length ? { "X-Cpm-Anubis-Binding": ["{cpm.anubis_binding}"] } : {}),
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
      ...apiHosts.length ? [{
        match: [{ expression: `(${expression}) && (${apiExpression})`,
          path: ["/", "/api/*", "/login", "/login/*", "/.within.website/x/cmd/anubis/api/*"] }],
        handle: [{ handler: "headers", response: { deferred: true, set: {
          "Cache-Control": ["private, no-store"], "Pragma": ["no-cache"],
        } } }],
      }] : [],
      {
        match: [{ expression, path: ["/.within.website/x/cmd/anubis/*", "/.within.website/x/xess/*"] }],
        handle: [...binding(), proxy()],
        terminal: true,
      },
      {
        match: [{ expression }],
        handle: [...binding(), {
          ...proxy(),
          // Like forward_auth, clone as GET so the service retains the body.
          // Preserve the original URI so challenges return to the same URL.
          rewrite: { method: "GET" },
          handle_response: [{
            match: { status_code: [204], headers: { "X-Cpm-Anubis-Verified": ["yes"] } },
            routes: [{ handle: [{ handler: "headers", response: { set: { "X-Anubis-Gate": ["passed"] } } }] }],
          }, ...apiHosts.length ? [{
            match: { status_code: [200], headers: { "Content-Type": ["text/html*"] } },
            routes: [{
              match: [{ expression: apiExpression, path: ["/api/*"] }],
              // Background API challenges must not clear a shared verification cookie.
              // The next page navigation performs verification and updates cookies.
              handle: [{ handler: "static_response", status_code: 403, headers: {
                "Content-Type": ["application/problem+json"], "Cache-Control": ["private, no-store"],
                "X-Anubis-Gate": ["challenge"],
              }, body: JSON.stringify({ type: "about:blank", title: "Proxy verification required", status: 403,
                detail: "Reload the page to complete proxy verification, then retry.",
                code: "proxy_verification_required", verification_url: "/" }) }],
              terminal: true,
            }, { handle: [{ handler: "copy_response" }] }],
          }] : []],
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
