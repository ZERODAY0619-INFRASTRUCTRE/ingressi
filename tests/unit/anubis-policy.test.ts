import { describe, it, expect } from "vitest";
import { anubisExpression, inAnubisScope } from "../../src/lib/anubis-policy";
import { buildAnubisGate } from "../../src/lib/caddy-anubis";

describe("Anubis gate policy", () => {
  it("keeps SSO bindings stable and limits API interception to explicit hosts", () => {
    const gate = buildAnubisGate("example.test", {
      roamingHost: "sso.example.test", roamingHosts: ["dashboard.example.test"], apiHosts: ["dashboard.example.test"],
    })!;
    const route = gate.routes.at(-1)!;
    const [mapping, proxy] = route.handle as any[];
    expect(mapping.mappings.map((value: any) => value.outputs[0])).toEqual(["sso:${1}", "dashboard.example.test:${1}"]);
    expect(mapping.defaults).toEqual(["{http.vars.client_ip}"]);
    const responses = proxy.handle_response;
    expect(responses[0].match.status_code).toEqual([204]);
    const failure = responses[1];
    expect(failure.match).toEqual({ status_code: [200], headers: { "Content-Type": ["text/html*"] } });
    expect(failure.routes[0].match[0].path).toEqual(["/api/*"]);
    expect(failure.routes[0].match[0].expression).toContain('"dashboard.example.test"');
    expect(failure.routes[0].match[0].expression).not.toContain('"sso.example.test"');
    expect(failure.routes[0].handle[0].status_code).toBe(403);
    expect(failure.routes[1].handle[0].handler).toBe("copy_response");
  });
  it("scopes roaming bindings without changing the client IP or accepting a supplied binding", () => {
    const gate = buildAnubisGate("example.test", { roamingHost: "sso.example.test" })!;
    for (const route of gate.routes.slice(1)) {
      const [mapping, proxy] = route.handle as any[];
      expect(mapping.handler).toBe("map");
      expect(mapping.defaults).toEqual(["{http.vars.client_ip}"]);
      const expression = new RegExp(mapping.mappings[0].input_regexp.replace("(?i)", ""), "i");
      expect(expression.test("sso.example.test|Safari")).toBe(true);
      expect(expression.test("SSO.EXAMPLE.TEST.|Safari")).toBe(true);
      expect(expression.test("other.example.test|Safari")).toBe(false);
      expect(expression.test("sso.example.test.evil|Safari")).toBe(false);
      expect(proxy.headers.request.set["X-Cpm-Anubis-Binding"]).toEqual(["{cpm.anubis_binding}"]);
      expect(proxy.headers.request.set["X-Real-IP"]).toEqual(["{http.vars.client_ip}"]);
    }
  });
  it("rejects roaming hosts outside the exact protected domain", () => {
    for (const roamingHost of ["example.test", "a.b.example.test", "sso.example.test.evil", "sso.example.test|.*"]) {
      expect(() => buildAnubisGate("example.test", { roamingHost })).toThrow("Invalid ANUBIS_ROAMING_HOST");
    }
  });
  it("preserves the deployed scope and disables the entire gate globally", () => {
    expect(buildAnubisGate(undefined)).toBeNull();
    expect(buildAnubisGate("example.test", { enabled: false })).toBeNull();
    expect(buildAnubisGate("example.test")!.routes).toHaveLength(3);
    expect(inAnubisScope("A.EXAMPLE.TEST.", "example.test")).toBe(true);
    expect(inAnubisScope("*.example.test", "example.test")).toBe(true);
    for (const domain of ["example.test", "a.b.example.test", "a.example.test.evil"]) {
      expect(inAnubisScope(domain, "example.test")).toBe(false);
    }
  });
  it("excludes every alias of a disabled host from every gate route", () => {
    const gate = buildAnubisGate("example.test", { hosts: [{ domains: ["a.example.test", "b.example.test"], enabled: true, anubisEnabled: false }] })!;
    for (const route of gate.routes) {
      expect(route.match[0].expression).toContain('!(');
      expect(route.match[0].expression).toContain('"a.example.test"');
      expect(route.match[0].expression).toContain('"b.example.test."');
    }
  });
  it("gives exact enabled hosts precedence over an opted-out wildcard", () => {
    const expression = anubisExpression("example.test", [
      { domains: ["*.example.test"], enabled: true, anubisEnabled: false },
      { domains: ["app.example.test"], enabled: true },
    ]);
    expect(expression).toContain(' in ["app.example.test","app.example.test."]');
    expect(expression).not.toContain('!(');
  });
  it("does not let disabled or unrelated proxy hosts change protection", () => {
    expect(anubisExpression("example.test", [
      { domains: ["*.example.test"], enabled: false, anubisEnabled: false },
      { domains: ["other.test"], enabled: true, anubisEnabled: false },
    ])).toBe(anubisExpression("example.test", []));
  });
  it("keeps duplicate names protected if any matching host requires protection", () => {
    expect(anubisExpression("example.test", [
      { domains: ["a.example.test"], enabled: true, anubisEnabled: false },
      { domains: ["a.example.test"], enabled: true, anubisEnabled: true },
    ])).toBe(anubisExpression("example.test", []));
  });
  it("keeps the original request and private verified-success contract", () => {
    const gate = buildAnubisGate("example.test")!;
    const check = gate.routes[2].handle[0] as any;
    expect(check.rewrite).toEqual({ method: "GET" });
    expect(check.handle_response[0].match).toEqual({ status_code: [204], headers: { "X-Cpm-Anubis-Verified": ["yes"] } });
    expect(gate.successServer.listen).toEqual(["127.0.0.1:8924"]);
  });
});
