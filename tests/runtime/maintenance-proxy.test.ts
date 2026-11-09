import { expect, test, mock, afterEach } from "bun:test";
import { NextRequest } from "next/server";
mock.module("../../src/lib/auth", () => ({ auth: async () => null }));
const { default: proxy } = await import("../../proxy");
const originalMode = process.env.MAINTENANCE_MODE;
afterEach(() => {
  if (originalMode === undefined) delete process.env.MAINTENANCE_MODE;
  else process.env.MAINTENANCE_MODE = originalMode;
});
test("maintenance returns 503 for pages, API writes, and HEAD without redirecting", async () => {
  process.env.MAINTENANCE_MODE = "1";
  const page = await proxy(new NextRequest("https://example.test/login"));
  expect(page.status).toBe(503);
  expect(page.headers.get("retry-after")).toBe("300");
  expect(page.headers.get("cache-control")).toBe("no-store");
  expect(await page.text()).toContain("Maintenance in progress");
  const api = await proxy(new NextRequest("https://example.test/api/v1/hosts", {method:"POST"}));
  expect(api.status).toBe(503);
  expect((await api.json()).code).toBe("MAINTENANCE");
  const head = await proxy(new NextRequest("https://example.test/", {method:"HEAD"}));
  expect(head.status).toBe(503);
  expect(await head.text()).toBe("");
});
test("maintenance preserves health probes and can be disabled", async () => {
  process.env.MAINTENANCE_MODE = "true";
  expect((await proxy(new NextRequest("https://example.test/api/health"))).status).toBe(200);
  process.env.MAINTENANCE_MODE = "0";
  expect((await proxy(new NextRequest("https://example.test/login"))).status).toBe(200);
  expect((await proxy(new NextRequest("https://example.test/"))).status).toBe(307);
});

test("only the two bundled font files are public for safe read methods", async () => {
  process.env.MAINTENANCE_MODE = "0";
  for (const path of ["/fonts/barlow-condensed-bold.ttf", "/fonts/ibm-plex-mono.ttf"]) {
    for (const method of ["GET", "HEAD"]) expect((await proxy(new NextRequest("https://example.test" + path, {method}))).status).toBe(200);
    expect((await proxy(new NextRequest("https://example.test" + path, {method:"POST"}))).status).toBe(307);
  }
  for (const path of ["/fonts/private.json", "/fonts/barlow-condensed-bold.ttf/extra", "/settings"]) expect((await proxy(new NextRequest("https://example.test" + path))).status).toBe(307);
});
