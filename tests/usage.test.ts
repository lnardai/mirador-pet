import { describe, expect, test } from "bun:test";
import { readUsage, toolName, usageCommands, usageFacts, usageNumbers } from "../usage.ts";

const report = {
  totals: { inputTokens: 100, outputTokens: 5000, cachedReadTokens: 700, cachedWriteTokens: 200, successPercent: 97.8, medianReplySeconds: 42, permissionPrompts: 3 },
  tools: [{ tool: "Bash", calls: 10 }, { tool: "mcp__canvas__ask", calls: 30 }],
  samples: [{ text: "secret words the user typed" }],
  conversations: { busiest: [{ title: "secret title" }] },
};

describe("the usage report", () => {
  test("gives the numbers and the favourite tool", () => {
    expect(usageNumbers(report)).toEqual({ outputTokens: 5000, cacheHitPercent: 70, favouriteTool: "ask", toolSuccessPercent: 97.8, medianReplySeconds: 42, permissionPrompts: 3 });
  });

  test("keeps nothing the user wrote", () => {
    expect(JSON.stringify(usageNumbers(report))).not.toContain("secret");
    expect(usageFacts(usageNumbers(report)).join(" ")).not.toContain("secret");
  });

  test("a period with no tokens or tools has no percent or favourite", () => {
    const numbers = usageNumbers({ totals: { successPercent: null, medianReplySeconds: null }, tools: [] });
    expect(numbers).toMatchObject({ cacheHitPercent: null, favouriteTool: null, toolSuccessPercent: null, medianReplySeconds: null, outputTokens: 0 });
    expect(usageFacts(numbers)).toEqual([]);
  });

  test("a report of another shape is none", () => {
    expect(usageNumbers({})).toBeNull();
    expect(usageNumbers(null)).toBeNull();
    expect(usageFacts(null)).toEqual([]);
  });

  test("a command that fails or prints something else reads as none", async () => {
    expect(await readUsage(() => Promise.reject(new Error("not found")))).toBeNull();
    expect(await readUsage(() => Promise.resolve("not json"))).toBeNull();
    expect(await readUsage(() => Promise.resolve(JSON.stringify(report)))).toMatchObject({ favouriteTool: "ask" });
  });

  test("the command beside the running host comes before the one on the PATH", () => {
    expect(usageCommands("/opt/mirador/host/main.ts", () => true)).toEqual(["/opt/mirador/bin/mirador", "mirador"]);
  });

  test("without a command beside the host, the PATH is all there is", () => {
    expect(usageCommands("/opt/app/main.js", () => false)).toEqual(["mirador"]);
    expect(usageCommands("", () => true)).toEqual(["mirador"]);
  });

  test("tool names read as people call them", () => {
    expect(toolName("mcp__canvas__ask")).toBe("ask");
    expect(toolName("Bash")).toBe("Bash");
  });
});
