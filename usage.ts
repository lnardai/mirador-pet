import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** What the pet shows of Mirador's usage report: numbers and a tool's name only, as the report also quotes what the user typed. */
export interface UsageNumbers {
  outputTokens: number;
  cacheHitPercent: number | null;
  favouriteTool: string | null;
  toolSuccessPercent: number | null;
  medianReplySeconds: number | null;
  permissionPrompts: number;
}

const ARGUMENTS = ["usage", "--json", "--since", "30d"];
const TIMEOUT_MS = 15_000;
const LARGEST_REPORT_BYTES = 64 * 1024 * 1024;

const numberOr = <Fallback>(value: unknown, fallback: Fallback) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

/** A tool as people call it: mcp__canvas__ask is ask. */
export const toolName = (tool: string) => tool.split("__").at(-1) ?? tool;

/** The numbers from the report of `mirador usage --json`, or null when it doesn't have the shape this was written for. */
export function usageNumbers(report: unknown): UsageNumbers | null {
  const { totals, tools } = (report ?? {}) as { totals?: Record<string, unknown>; tools?: unknown };
  if (!totals || typeof totals !== "object") return null;
  const input = numberOr(totals.inputTokens, 0);
  const cachedRead = numberOr(totals.cachedReadTokens, 0);
  const cachedWrite = numberOr(totals.cachedWriteTokens, 0);
  const prompted = input + cachedRead + cachedWrite;
  const called = (Array.isArray(tools) ? tools : []) as { tool?: unknown; calls?: unknown }[];
  const favourite = called.filter(({ tool }) => typeof tool === "string").sort((a, b) => numberOr(b.calls, 0) - numberOr(a.calls, 0))[0];
  return {
    outputTokens: numberOr(totals.outputTokens, 0),
    cacheHitPercent: prompted > 0 ? Math.round((cachedRead / prompted) * 1000) / 10 : null,
    favouriteTool: favourite ? toolName(favourite.tool as string) : null,
    toolSuccessPercent: numberOr(totals.successPercent, null),
    medianReplySeconds: numberOr(totals.medianReplySeconds, null),
    permissionPrompts: numberOr(totals.permissionPrompts, 0),
  };
}

/**
 * Where the command is: beside the Mirador this plugin runs in, whose host/main.ts is the running script, else on the PATH.
 * The host's own PATH often lacks it, as Mirador only adds its bin folder for its agents, and Bun too, so it gets the host's.
 */
export function usageCommands(runningScript = process.argv[1], exists: (file: string) => boolean = existsSync): string[] {
  const beside = runningScript ? join(dirname(resolve(runningScript)), "..", "bin", "mirador") : null;
  return beside && exists(beside) ? [beside, "mirador"] : ["mirador"];
}

const runOne = (command: string) =>
  new Promise<string>((done, failed) => {
    execFile(command, ARGUMENTS, { env: { ...process.env, MIRADOR_BUN: process.execPath }, timeout: TIMEOUT_MS, maxBuffer: LARGEST_REPORT_BYTES }, (error, stdout) => (error ? failed(error) : done(stdout)));
  });

async function runCommand(): Promise<string> {
  const [first, ...others] = usageCommands();
  let attempt = runOne(first!);
  for (const command of others) attempt = attempt.catch(() => runOne(command));
  return attempt;
}

/** The last 30 days' numbers, or null when the command can't be found or fails: the pet then just doesn't show them. */
export async function readUsage(run: () => Promise<string> = runCommand): Promise<UsageNumbers | null> {
  try {
    return usageNumbers(JSON.parse(await run()));
  } catch {
    return null;
  }
}

/** The facts from the numbers the pet may bring up, as sentences for the model. */
export function usageFacts(usage: UsageNumbers | null): string[] {
  if (!usage) return [];
  const facts: string[] = [];
  if (usage.favouriteTool) facts.push(`Their agents' favourite tool this month is ${usage.favouriteTool}.`);
  if (usage.outputTokens > 0) facts.push(`Their agents wrote ${usage.outputTokens} tokens this month.`);
  if (usage.toolSuccessPercent !== null) facts.push(`${usage.toolSuccessPercent}% of their agents' tool calls succeeded this month.`);
  if (usage.medianReplySeconds !== null) facts.push(`They usually answer their agents within ${Math.round(usage.medianReplySeconds)} seconds.`);
  return facts;
}
