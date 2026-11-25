import { parseUpstreamTarget } from "./caddy-utils";

/** Shared transport for authentication checks and browser outpost requests. */
export function buildAuthentikUpstream(upstream: string) {
  const target = parseUpstreamTarget(upstream);
  return {
    upstreams: [{ dial: target.dial }],
    ...(target.scheme === "https" ? {
      transport: {
        protocol: "http",
        tls: { server_name: target.host!.replace(/^\[|\]$/g, "") },
      },
    } : {}),
  };
}
