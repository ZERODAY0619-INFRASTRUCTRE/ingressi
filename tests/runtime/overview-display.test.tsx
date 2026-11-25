import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KpiRow, TrafficUnavailable } from "../../app/(dashboard)/_overview/TrafficSection";
import type { OverviewTraffic } from "../../src/lib/overview-shared";

function traffic(requests: number): OverviewTraffic {
  return {
    status: "ok", range: { preset: "24h", start: 0, end: 86400, step: 1800, buckets: 48 },
    served: [], mitigated: [], totals: { requests, mitigated: requests / 4, mitigatedShare: requests ? 0.25 : 0, errors5xx: 0, errorRate5xx: 0, bytes: 0 },
    previous: null, sparklines: { requests: [], mitigated: [], errors5xx: [], bytes: [] }, peakMitigated: null, topErrorHost: null,
  };
}
describe("overview data semantics", () => {
  test("unavailable and disabled analytics remain distinguishable", () => {
    expect(renderToStaticMarkup(<TrafficUnavailable status="unavailable" />)).toContain("Traffic could not be read");
    expect(renderToStaticMarkup(<TrafficUnavailable status="disabled" />)).toContain("Analytics are off");
  });
  test("empty traffic has no measured ratio", () => {
    expect(renderToStaticMarkup(<KpiRow traffic={traffic(0)} range="24h" />)).toContain("No ratio data");
    const measured = renderToStaticMarkup(<KpiRow traffic={traffic(200)} range="24h" />);
    expect(measured).toContain("25%");
    expect(measured).not.toContain("No ratio data");
  });
});
