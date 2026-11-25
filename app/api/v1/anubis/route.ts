import { validateAnubisOptions, type AnubisOptions } from "@/src/lib/anubis-options";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import db, { nowIso } from "@/src/lib/db";
import { proxyHosts } from "@/src/lib/db/schema";
import { apiErrorResponse, requireApiPermission, NotFoundError, logUnexpectedApiError } from "@/src/lib/api-auth";
import { ApiValidationError, ApiConflictError } from "@/src/lib/api-errors";
import { getAnubisStatus } from "@/src/lib/anubis-settings";
import { inAnubisScope } from "@/src/lib/anubis-policy";
import { getSetting, setSetting, clearSetting } from "@/src/lib/settings";
import { applyCaddyConfig } from "@/src/lib/caddy";
import { withSettingsUpdateLock } from "@/src/lib/settings-update-lock";
import { logAuditEvent } from "@/src/lib/audit";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission(request, "settings:read");
    return NextResponse.json(await getAnubisStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireApiPermission(request, "settings:write");
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiValidationError("Invalid JSON payload"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiValidationError("Expected an object");
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some(key => !["enabled", "hostId", "options"].includes(key)) || (input.enabled !== undefined && typeof input.enabled !== "boolean") || (input.enabled === undefined && input.options === undefined)) {
      throw new ApiValidationError("Provide a boolean enabled value and optional positive hostId");
    }
    const enabled = input.enabled as boolean | undefined;
    let options: AnubisOptions | undefined;
    if (input.options !== undefined) {
      try { options = validateAnubisOptions(input.options); }
      catch (error) { throw new ApiValidationError(error instanceof Error ? error.message : "Invalid Anubis options"); }
    }
    if (input.hostId !== undefined && (options !== undefined || enabled === undefined)) throw new ApiValidationError("Host updates only accept enabled");
    const hostId = input.hostId;
    if (hostId !== undefined && (typeof hostId !== "number" || !Number.isSafeInteger(hostId) || hostId <= 0)) {
      throw new ApiValidationError("Invalid hostId");
    }
    return await withSettingsUpdateLock(async () => {
      const status = await getAnubisStatus();
      if (!status.available || !status.domain) throw new ApiConflictError("Anubis is not configured for this instance");
      if (options && !status.configurable) throw new ApiConflictError("Anubis runtime settings are not configured for this instance");
      let restore: () => Promise<void>;
      if (typeof hostId === "number") {
        const host = await db.query.proxyHosts.findFirst({ where: eq(proxyHosts.id, hostId) });
        if (!host) throw new NotFoundError("Proxy host not found");
        const domains = JSON.parse(host.domains) as string[];
        if (!domains.some(domain => inAnubisScope(domain, status.domain!))) {
          throw new ApiConflictError("This host is outside the configured Anubis domain scope");
        }
        const previous = JSON.parse(host.meta || "{}") as Record<string, unknown>;
        restore = async () => {
          const current = await db.query.proxyHosts.findFirst({ where: eq(proxyHosts.id, hostId) });
          if (!current) return;
          const meta = JSON.parse(current.meta || "{}") as Record<string, unknown>;
          if (previous.anubis_enabled === undefined) delete meta.anubis_enabled;
          else meta.anubis_enabled = previous.anubis_enabled;
          await db.update(proxyHosts).set({ meta: JSON.stringify(meta), updatedAt: nowIso() }).where(eq(proxyHosts.id, hostId));
        };
        await db.update(proxyHosts).set({ meta: JSON.stringify({ ...previous, anubis_enabled: enabled }), updatedAt: nowIso() }).where(eq(proxyHosts.id, hostId));
      } else {
        const previous = await getSetting<unknown>("anubis");
        restore = () => previous === null ? clearSetting("anubis") : setSetting("anubis", previous);
        await setSetting("anubis", { ...(previous && typeof previous === "object" ? previous : {}), ...(enabled !== undefined ? { enabled } : {}), ...(options ? { options } : {}) });
      }
      try { await applyCaddyConfig(); }
      catch (error) {
        logUnexpectedApiError("Anubis configuration apply failed", error);
        await restore();
        try { await applyCaddyConfig(); }
        catch (restoreError) {
          logUnexpectedApiError("Anubis configuration recovery failed", restoreError);
          return NextResponse.json({ error: "Settings restored, but Caddy recovery could not be confirmed. Check Caddy before retrying." }, { status: 502 });
        }
        return NextResponse.json({ error: "Caddy apply failed. Previous settings and configuration were restored." }, { status: 502 });
      }
      logAuditEvent({ userId, action: "update", entityType: "anubis", entityId: typeof hostId === "number" ? hostId : null,
        summary: options ? "Updated Anubis runtime settings" : `${enabled ? "Enabled" : "Disabled"} ${hostId === undefined ? "global" : "host"} Anubis protection`, data: { enabled, hostId, options } });
      return NextResponse.json({ ok: true, enabled });
    });
  } catch (error) { return apiErrorResponse(error); }
}
