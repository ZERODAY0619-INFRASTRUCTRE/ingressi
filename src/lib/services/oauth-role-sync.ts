import db from "../db";
import { accounts, oauthProviders, users, auditEvents } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { config } from "../config";
import { decryptSecret } from "../secret";
import { resolveOAuthAccountIssuer } from "../account-issuer";

/** Fetch only from the configured provider, and bind the claim to its subject. */
export async function fetchOAuthRole(
  provider: { issuer: string | null; userinfoUrl: string | null },
  account: { accountId: string; accessToken: string },
): Promise<"admin" | "user" | "viewer"> {
  let endpoint = provider.userinfoUrl;
  if (!endpoint) {
    if (!provider.issuer) throw new Error("OAuth role sync requires an issuer or UserInfo URL");
    const response = await fetch(provider.issuer.replace(/\/$/, "") + "/.well-known/openid-configuration", {
      redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("OAuth role discovery failed");
    const discovery = await response.json();
    endpoint = discovery.userinfo_endpoint;
    if (!endpoint || new URL(endpoint).origin !== new URL(provider.issuer).origin) {
      throw new Error("OAuth role discovery returned an unexpected UserInfo origin");
    }
  }
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${account.accessToken}` },
    redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("OAuth role UserInfo request failed");
  const profile = await response.json();
  if (typeof profile.sub !== "string" || profile.sub !== account.accountId) {
    throw new Error("OAuth role UserInfo subject does not match the authenticated account");
  }
  // Missing or unrecognized claims must never preserve an old admin grant.
  return profile.role === "admin" || profile.role === "viewer" ? profile.role : "user";
}

/** Runs after OAuth account persistence, before the OAuth callback completes. */
export async function syncOAuthRoleFromClaims(account: {
  id: string | number; userId: string | number; providerId: string;
}): Promise<void> {
  if (!config.auth.allowOauthRoleFromClaims || account.providerId === "credential") return;
  const provider = db.select().from(oauthProviders)
    .where(and(eq(oauthProviders.id, account.providerId), eq(oauthProviders.enabled, true))).get();
  if (!provider) return;
  const userId = Number(account.userId);
  const stored = db.select().from(accounts).where(and(
    eq(accounts.id, Number(account.id)), eq(accounts.userId, userId),
    eq(accounts.providerId, provider.id),
    eq(accounts.issuer, resolveOAuthAccountIssuer(provider.id, provider.issuer)),
  )).get();
  if (!stored?.accessToken) throw new Error("OAuth role sync requires a persisted authenticated account");
  const role = await fetchOAuthRole(provider, {
    accountId: stored.accountId, accessToken: decryptSecret(stored.accessToken),
  });
  db.transaction((tx) => {
    const user = tx.select().from(users).where(eq(users.id, userId)).get();
    if (!user) throw new Error("OAuth role sync user is missing");
    if (user.role === role) return;
    const now = new Date().toISOString();
    tx.update(users).set({ role, updatedAt: now }).where(eq(users.id, userId)).run();
    tx.insert(auditEvents).values({
      userId, action: "oauth_role_sync", entityType: "user", entityId: userId,
      summary: `Synced role from OAuth provider ${provider.id}: ${user.role} -> ${role}`,
      createdAt: now,
    }).run();
  });
}
