import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const state = vi.hoisted(() => ({
  setting: null as unknown,
  host: { id: 7, domains: '["app.example.test"]', meta: '{"unrelated":"keep"}' } as any,
  available: true, configurable: true,
  apply: vi.fn(), auth: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/src/lib/api-auth", () => ({
  requireApiPermission: state.auth,
  logUnexpectedApiError: vi.fn(),
  NotFoundError: class extends Error { status = 404; },
  apiErrorResponse: (e: any) => NextResponse.json({ error: e.message }, { status: e.status ?? 500 }),
}));
vi.mock("@/src/lib/settings", () => ({
  getSetting: async () => state.setting,
  setSetting: async (_key: string, value: unknown) => { state.setting = value; },
  clearSetting: async () => { state.setting = null; },
}));
vi.mock("@/src/lib/anubis-settings", () => ({ getAnubisStatus: async () => ({ available: state.available, enabled: true, configurable: state.configurable, domain: state.available ? "example.test" : null }) }));
vi.mock("@/src/lib/caddy", () => ({ applyCaddyConfig: state.apply }));
vi.mock("@/src/lib/audit", () => ({ logAuditEvent: state.audit }));
vi.mock("@/src/lib/db", () => ({
  nowIso: () => "2026-01-01T00:00:00Z",
  default: {
    query: { proxyHosts: { findFirst: async () => state.host } },
    update: () => ({ set: (value: any) => ({ where: async () => { Object.assign(state.host, value); } }) }),
  },
}));
import { GET, PUT } from "../../../app/api/v1/anubis/route";
const request = (body: unknown) => new NextRequest("http://localhost/api/v1/anubis", { method: "PUT", body: JSON.stringify(body) });
beforeEach(() => {
  state.setting = null; state.available = true; state.configurable = true;
  state.host = { id: 7, domains: '["app.example.test"]', meta: '{"unrelated":"keep"}' };
  state.apply.mockReset().mockResolvedValue(undefined);
  state.auth.mockReset().mockResolvedValue({ userId: 1 }); state.audit.mockReset();
});
describe("Anubis permission API", () => {
  it("requires the corresponding settings permission before reading or writing", async () => {
    state.auth.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    expect((await GET(new NextRequest("http://localhost/api/v1/anubis"))).status).toBe(403);
    expect((await PUT(request({ enabled: false }))).status).toBe(403);
    expect(state.auth.mock.calls.map(call => call[1])).toEqual(["settings:read", "settings:write"]);
    expect(state.setting).toBeNull(); expect(state.apply).not.toHaveBeenCalled();
  });
  it.each([{ enabled: "false" }, { enabled: false, hostId: -1 }, { enabled: false, hostId: "7" }, { enabled: false, extra: true }, []])("rejects malformed input %j", async body => {
    expect((await PUT(request(body))).status).toBe(400); expect(state.apply).not.toHaveBeenCalled();
  });
  it("applies global changes without replacing host preferences", async () => {
    const meta = state.host.meta;
    expect((await PUT(request({ enabled: false }))).status).toBe(200);
    expect(state.setting).toEqual({ enabled: false }); expect(state.host.meta).toBe(meta);
    expect(state.audit).toHaveBeenCalledOnce();
  });
  it("only changes the selected host's Anubis metadata", async () => {
    expect((await PUT(request({ enabled: false, hostId: 7 }))).status).toBe(200);
    expect(JSON.parse(state.host.meta)).toEqual({ unrelated: "keep", anubis_enabled: false });
    expect(state.setting).toBeNull();
  });
  it("rejects unavailable instances and hosts outside the deployment scope", async () => {
    state.available = false;
    expect((await PUT(request({ enabled: true }))).status).toBe(409);
    state.available = true; state.host.domains = '["elsewhere.test"]';
    expect((await PUT(request({ enabled: true, hostId: 7 }))).status).toBe(409);
    state.host = undefined;
    expect((await PUT(request({ enabled: true, hostId: 7 }))).status).toBe(404);
    expect(state.apply).not.toHaveBeenCalled();
  });
  it("restores an absent global setting and reapplies after failure", async () => {
    state.apply.mockRejectedValueOnce(new Error("apply failed"));
    expect((await PUT(request({ enabled: false }))).status).toBe(502);
    expect(state.setting).toBeNull(); expect(state.apply).toHaveBeenCalledTimes(2); expect(state.audit).not.toHaveBeenCalled();
  });
  it("restores the host preference without discarding other metadata", async () => {
    state.apply.mockRejectedValueOnce(new Error("apply failed"));
    expect((await PUT(request({ enabled: false, hostId: 7 }))).status).toBe(502);
    expect(JSON.parse(state.host.meta)).toEqual({ unrelated: "keep" });
  });
  it("reports an unconfirmed recovery instead of claiming success", async () => {
    state.apply.mockRejectedValue(new Error("offline"));
    const response = await PUT(request({ enabled: false }));
    expect(response.status).toBe(502); expect((await response.json()).error).toContain("could not be confirmed");
    expect(state.setting).toBeNull();
  });
});

import { DEFAULT_ANUBIS_OPTIONS } from "../../../src/lib/anubis-options";
it("saves runtime options without changing the global toggle", async () => {
  state.setting = { enabled: false };
  expect((await PUT(request({ options: DEFAULT_ANUBIS_OPTIONS }))).status).toBe(200);
  expect(state.setting).toEqual({ enabled: false, options: DEFAULT_ANUBIS_OPTIONS });
});
it("keeps runtime options when only changing global protection", async () => {
  state.setting = { enabled: false, options: DEFAULT_ANUBIS_OPTIONS };
  expect((await PUT(request({ enabled: true }))).status).toBe(200);
  expect(state.setting).toEqual({ enabled: true, options: DEFAULT_ANUBIS_OPTIONS });
});
it("rejects unavailable runtime configuration and restores options after apply failure", async () => {
  state.configurable = false;
  expect((await PUT(request({ options: DEFAULT_ANUBIS_OPTIONS }))).status).toBe(409);
  state.configurable = true;
  state.setting = { enabled: true, options: DEFAULT_ANUBIS_OPTIONS };
  state.apply.mockRejectedValueOnce(new Error("runtime not ready"));
  expect((await PUT(request({ options: { ...DEFAULT_ANUBIS_OPTIONS, difficulty: 2 } }))).status).toBe(502);
  expect(state.setting).toEqual({ enabled: true, options: DEFAULT_ANUBIS_OPTIONS });
});
it("rejects invalid runtime settings without starting an apply", async () => {
  expect((await PUT(request({ options: { ...DEFAULT_ANUBIS_OPTIONS, difficulty: 99 } }))).status).toBe(400);
  expect((await PUT(request({ enabled: true, hostId: 7, options: DEFAULT_ANUBIS_OPTIONS }))).status).toBe(400);
  expect(state.apply).not.toHaveBeenCalled();
});
