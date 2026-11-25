export const DEFAULT_ANUBIS_OPTIONS = {
  algorithm: "fast" as "fast" | "slow" | "metarefresh",
  difficulty: 4,
  cookieHours: 24,
  language: "" as "" | "en" | "ko" | "ja" | "de" | "fr" | "es",
  simplified: false,
  robots: false,
};
export type AnubisOptions = typeof DEFAULT_ANUBIS_OPTIONS;

/** Shared by the console API and the isolated Anubis supervisor. */
export function validateAnubisOptions(input: unknown): AnubisOptions {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected Anubis options object");
  const o = input as Record<string, unknown>;
  if (Object.keys(o).some(key => !Object.hasOwn(DEFAULT_ANUBIS_OPTIONS, key))) throw new Error("Unknown Anubis option");
  if (!["fast", "slow", "metarefresh"].includes(o.algorithm as string)) throw new Error("Invalid challenge algorithm");
  if (!Number.isInteger(o.difficulty) || Number(o.difficulty) < 1 || Number(o.difficulty) > 8) throw new Error("Difficulty must be an integer from 1 to 8");
  if (!Number.isInteger(o.cookieHours) || Number(o.cookieHours) < 1 || Number(o.cookieHours) > 168) throw new Error("Cookie lifetime must be 1 to 168 hours");
  if (!["", "en", "ko", "ja", "de", "fr", "es"].includes(o.language as string)) throw new Error("Invalid language");
  if (typeof o.simplified !== "boolean" || typeof o.robots !== "boolean") throw new Error("Explanation and robots options must be booleans");
  return { algorithm: o.algorithm as AnubisOptions["algorithm"], difficulty: Number(o.difficulty), cookieHours: Number(o.cookieHours), language: o.language as AnubisOptions["language"], simplified: o.simplified, robots: o.robots };
}
