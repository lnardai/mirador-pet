import { describe, expect, test } from "bun:test";
import { cleanName } from "../host.ts";

describe("the pet's name", () => {
  test("stays as typed, without the spaces around it", () => {
    expect(cleanName("  Mr. Blob ")).toBe("Mr. Blob");
    expect(cleanName("Pötty")).toBe("Pötty");
  });

  test("stays on one line", () => {
    expect(cleanName("Mr\n\tBlob")).toBe("Mr Blob");
  });

  test("is cut to 24 characters, without splitting one or ending in a space", () => {
    expect(cleanName("a".repeat(40))).toBe("a".repeat(24));
    expect(cleanName("🐾".repeat(30))).toBe("🐾".repeat(24));
    expect(cleanName(`${"a".repeat(23)} bcd`)).toBe("a".repeat(23));
  });

  test("can't be empty or something other than text", () => {
    expect(() => cleanName("   ")).toThrow("needs a name");
    expect(() => cleanName(undefined)).toThrow("needs a name");
  });
});
