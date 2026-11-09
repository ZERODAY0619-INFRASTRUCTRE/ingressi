import { describe, expect, it } from "vitest";
import { DEFAULT_ANUBIS_OPTIONS, validateAnubisOptions } from "../../src/lib/anubis-options";

describe("Anubis runtime option contract", () => {
  it("accepts the deployed defaults and bounded form settings", () => {
    expect(validateAnubisOptions(DEFAULT_ANUBIS_OPTIONS)).toEqual(DEFAULT_ANUBIS_OPTIONS);
    expect(validateAnubisOptions({ ...DEFAULT_ANUBIS_OPTIONS, algorithm: "metarefresh", difficulty: 8, cookieHours: 168, language: "ko", simplified: true, robots: true }).cookieHours).toBe(168);
  });
  const invalidOptions: Record<string, unknown>[] = [
    { difficulty: 0 }, { difficulty: 9 }, { difficulty: 1.5 }, { difficulty: "4" },
    { cookieHours: 0 }, { cookieHours: 169 }, { language: "unknown" },
    { algorithm: "unknown" }, { simplified: "false" }, { robots: 1 },
    { target: "http://elsewhere.test" }, { command: "something" }, { toString: "unexpected" },
  ];
  for (const change of invalidOptions) {
    it(`rejects unsupported options ${JSON.stringify(change)}`, () => {
      expect(() => validateAnubisOptions({ ...DEFAULT_ANUBIS_OPTIONS, ...change })).toThrow();
    });
  }
});
