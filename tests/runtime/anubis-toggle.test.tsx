import { expect, test, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
mock.module("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
const { AnubisToggle } = await import("../../src/components/anubis/AnubisToggle");
const status = { available: true, enabled: true, domain: "example.test" };
const host = { id: 1, name: "App", domains: ["app.example.test"], enabled: true, anubisEnabled: true };

test("global toggle is labeled and explains that host preferences survive", () => {
  const html = renderToStaticMarkup(<AnubisToggle initial={status} />);
  expect(html).toContain('aria-label="Enable Anubis globally"');
  expect(html).toContain('aria-checked="true"');
  expect(html).toContain("Host choices are kept");
});
test("global off pauses host protection while preserving its selected toggle", () => {
  const html = renderToStaticMarkup(<AnubisToggle initial={{ ...status, enabled: false }} host={host} />);
  expect(html).toContain('aria-checked="true"');
  expect(html).toContain("Paused — global protection is off");
});
test("unavailable instances and out-of-scope hosts cannot be toggled", () => {
  const internal = renderToStaticMarkup(<AnubisToggle initial={{ available: false, enabled: false, domain: null }} />);
  expect(internal).toContain('disabled=""'); expect(internal).toContain("Not configured");
  const outside = renderToStaticMarkup(<AnubisToggle initial={status} host={{ ...host, domains: ["other.test"] }} />);
  expect(outside).toContain('disabled=""'); expect(outside).toContain("Outside protected domain scope");
});
test("an opted-out host stays unchecked even when global protection is on", () => {
  const html = renderToStaticMarkup(<AnubisToggle initial={status} host={{ ...host, anubisEnabled: false }} />);
  expect(html).toContain('aria-checked="false"'); expect(html).toContain("Protection off");
});
