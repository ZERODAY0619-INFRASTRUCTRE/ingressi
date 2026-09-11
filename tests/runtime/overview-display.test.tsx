import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OverviewClient from "../../app/(dashboard)/OverviewClient";

const defaults = { userName: "Fixture operator", stats: [], recentEvents: [], isAdmin: true };
describe("command overview data semantics", () => {
  test("unavailable and disabled collection do not appear as zero traffic", () => {
    const unavailable = renderToStaticMarkup(<OverviewClient {...defaults} trafficSummary={null} />);
    expect(unavailable).toContain("DATA UNAVAILABLE");
    expect(unavailable).toContain("Blocked ratio unavailable");
    const disabled = renderToStaticMarkup(<OverviewClient {...defaults} trafficSummary={{ totalRequests: 0, blockedPercent: 0, analyticsDisabled: true }} />);
    expect(disabled).toContain("COLLECTION DISABLED");
    expect(disabled).not.toContain("NO REQUESTS RECORDED");
  });
  test("an empty sample has no percentage; measured traffic uses its real blocked ratio", () => {
    const empty = renderToStaticMarkup(<OverviewClient {...defaults} trafficSummary={{ totalRequests: 0, blockedPercent: 0 }} />);
    expect(empty).toContain("NO REQUESTS RECORDED");
    expect(empty).toContain("NO RATIO DATA");
    const measured = renderToStaticMarkup(<OverviewClient {...defaults} trafficSummary={{ totalRequests: 200, blockedPercent: 25 }} />);
    expect(measured).toContain("25.0 percent blocked");
    expect(measured).toContain("REQUESTS RECORDED");
  });
  test("non-admin overview exposes account navigation without administrative telemetry", () => {
    const html = renderToStaticMarkup(<OverviewClient {...defaults} isAdmin={false} trafficSummary={null} />);
    expect(html).toContain('href="/profile"');
    expect(html).not.toContain('href="/analytics"');
    expect(html).not.toContain("RESOURCE REGISTRY");
  });
});
