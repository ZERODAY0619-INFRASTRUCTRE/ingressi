import { test, expect, beforeEach, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "../../src/lib/db/schema";
import { eq } from "drizzle-orm";

// This suite runs in its own Bun process, with an in-memory DB and no production secrets.
process.env.DATABASE_URL = ":memory:";
Object.assign(process.env, { NODE_ENV: "test", AUTH_RATE_LIMIT_ENABLED: "false" });
process.env.SESSION_SECRET = "role-sync-test-secret-at-least-32-characters";
process.env.AUTH_ALLOW_OAUTH_ROLE_FROM_CLAIMS = "true";
const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: "drizzle" });
Object.assign(globalThis, { __DRIZZLE_DB__: db, __SQLITE_CLIENT__: sqlite });
const { syncOAuthRoleFromClaims, fetchOAuthRole } = await import("../../src/lib/services/oauth-role-sync");
const { encryptSecret } = await import("../../src/lib/secret");
const { config } = await import("../../src/lib/config");
const originalFetch = globalThis.fetch;
const now = new Date().toISOString();
let profile: Record<string, unknown>;
let requests: string[];
const account = { id: 1, userId: 1, providerId: "authentik" };

beforeEach(() => {
  sqlite.exec("DELETE FROM audit_events; DELETE FROM accounts; DELETE FROM users; DELETE FROM oauth_providers;");
  config.auth.allowOauthRoleFromClaims = true;
  db.insert(schema.users).values({ id: 1, email: "member@example.test", role: "user", status: "active", createdAt: now, updatedAt: now }).run();
  db.insert(schema.oauthProviders).values({ id: "authentik", name: "Authentik", type: "oidc", clientId: "test", clientSecret: "test", issuer: "https://idp.example/application/o/icpm/", userinfoUrl: "https://idp.example/userinfo", authorizationUrl: "https://idp.example/authorize", tokenUrl: "https://idp.example/token", enabled: true, source: "env", createdAt: now, updatedAt: now }).run();
  db.insert(schema.accounts).values({ ...account, issuer: "https://idp.example/application/o/icpm/", accountId: "member-sub", accessToken: encryptSecret("test-access-token"), createdAt: now, updatedAt: now }).run();
  profile = { sub: "member-sub", groups: ["cpm-admins"], role: "admin" };
  requests = [];
  globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
    requests.push(String(url));
    expect(options?.redirect).toBe("error");
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-access-token");
    return Response.json(profile);
  }) as unknown as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; sqlite.close(); });
const role = () => db.select().from(schema.users).where(eq(schema.users.email, "member@example.test")).get()!.role;

test("authenticated cpm-admins role promotes existing account and audits the change", async () => {
  await syncOAuthRoleFromClaims(account);
  expect(role()).toBe("admin");
  expect(db.select().from(schema.auditEvents).all()).toHaveLength(1);
  await syncOAuthRoleFromClaims(account);
  expect(db.select().from(schema.auditEvents).all()).toHaveLength(1);
});
test("later login demotes when Authentik removes admin role", async () => {
  await syncOAuthRoleFromClaims(account);
  profile = { sub: "member-sub", groups: [], role: "user" };
  await syncOAuthRoleFromClaims(account);
  expect(role()).toBe("user");
});
test("missing or invalid role cannot preserve admin", async () => {
  for (const value of [undefined, "superadmin", ["admin"]]) {
    db.update(schema.users).set({ role: "admin" }).run();
    profile = { sub: "member-sub", role: value };
    await syncOAuthRoleFromClaims(account);
    expect(role()).toBe("user");
  }
});
test("subject mismatch cannot grant a role", async () => {
  profile.sub = "another-user";
  await expect(syncOAuthRoleFromClaims(account)).rejects.toThrow("subject");
  expect(role()).toBe("user");
});
test("disabled opt-in and credentials do not query provider or change roles", async () => {
  config.auth.allowOauthRoleFromClaims = false;
  await syncOAuthRoleFromClaims(account);
  config.auth.allowOauthRoleFromClaims = true;
  await syncOAuthRoleFromClaims({ ...account, providerId: "credential" });
  expect(requests).toHaveLength(0);
  expect(role()).toBe("user");
});
test("wrong account binding is rejected before using a token", async () => {
  await expect(syncOAuthRoleFromClaims({ ...account, userId: 99 })).rejects.toThrow("persisted");
  expect(requests).toHaveLength(0);
});
test("provider errors do not grant admin", async () => {
  globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;
  await expect(syncOAuthRoleFromClaims(account)).rejects.toThrow("UserInfo");
  expect(role()).toBe("user");
});
test("discovery cannot redirect bearer token to a different origin", async () => {
  globalThis.fetch = (async () => Response.json({ userinfo_endpoint: "https://other.example/userinfo" })) as unknown as typeof fetch;
  await expect(fetchOAuthRole({ issuer: "https://idp.example", userinfoUrl: null }, { accountId: "member-sub", accessToken: "test-access-token" })).rejects.toThrow("origin");
});

test("real OAuth callbacks sync new and existing accounts and expose the fresh role in session", async () => {
  const { getAuth, invalidateProviderCache } = await import("../../src/lib/auth-server");
  config.auth.allowOauthRegistration = true;
  invalidateProviderCache();
  const auth = getAuth();
  const base = config.baseUrl;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = String(url);
    if (target === "https://idp.example/token") {
      return Response.json({ access_token: "test-access-token", token_type: "Bearer", expires_in: 300 });
    }
    if (target === "https://idp.example/userinfo") {
      return Response.json({ ...profile, id: profile.sub, email: "member@example.test", email_verified: true, name: "Member" });
    }
    throw new Error(`Unexpected test network request: ${target}`);
  }) as unknown as typeof fetch;
  for (const mode of ["existing", "new"]) {
  if (mode === "new") sqlite.exec("DELETE FROM sessions; DELETE FROM audit_events; DELETE FROM accounts; DELETE FROM users;");
  for (const expectedRole of ["admin", "user"]) {
    profile = { sub: "member-sub", role: expectedRole, groups: expectedRole === "admin" ? ["cpm-admins"] : [] };
    const start = await auth.handler(new Request(`${base}/api/auth/sign-in/social`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ provider: "authentik", callbackURL: `${base}/` }),
    }));
    expect(start.status).toBe(200);
    const authUrl = new URL((await start.json()).url);
    const cookies = start.headers.getSetCookie().map((v: string) => v.split(";")[0]).join("; ");
    const callback = await auth.handler(new Request(`${base}/api/auth/callback/authentik?code=test-code&state=${encodeURIComponent(authUrl.searchParams.get("state")!)}`, {
      headers: { Cookie: cookies },
    }));
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).not.toContain("error");
    expect(role()).toBe(expectedRole);
    const sessionCookies = callback.headers.getSetCookie().map((v: string) => v.split(";")[0]).join("; ");
    const session = await auth.handler(new Request(`${base}/api/auth/get-session`, { headers: { Cookie: sessionCookies } }));
    expect((await session.json()).user.role).toBe(expectedRole);
  }
  }
});
