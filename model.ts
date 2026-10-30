import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** An OpenAI-compatible chat endpoint the pet asks for its lines, one sentence at a time. */
export interface ModelConfig {
  url: string;
  model: string;
  key: string | null;
}

/**
 * PET_MODEL_URL (such as http://host:8080/v1), PET_MODEL and an optional PET_MODEL_KEY; read at each line, so edits apply at once.
 * PET_UNLOCK_ALL=1 lets the pet wear every hat and skin, and PET_ALWAYS_FIND=1 brings a box with every message, for trying them out.
 */
export const CONFIG_FILE = join(homedir(), ".config", "mirador-pet", "model.env");

/** A line slower than this isn't worth waiting for: the pet says one of its own. */
const TIMEOUT_MS = 8000;

const LONGEST_LINE = 140;

export function parseSettings(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split("\n")) {
    const match = /^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values.set(match[1]!, match[2]!.replace(/^(["'])(.*)\1$/, "$2"));
  }
  return values;
}

function readSettings(file: string): Map<string, string> {
  try {
    return parseSettings(readFileSync(file, "utf8"));
  } catch {
    return new Map();
  }
}

export function parseConfig(text: string): ModelConfig | null {
  const values = parseSettings(text);
  const url = values.get("PET_MODEL_URL");
  const model = values.get("PET_MODEL");
  if (!url || !model) return null;
  return { url: url.replace(/\/+$/, ""), model, key: values.get("PET_MODEL_KEY") || null };
}

export function readConfig(file = CONFIG_FILE): ModelConfig | null {
  try {
    return parseConfig(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export const readUnlockAll = (file = CONFIG_FILE) => readSettings(file).get("PET_UNLOCK_ALL") === "1";

export const readAlwaysFind = (file = CONFIG_FILE) => readSettings(file).get("PET_ALWAYS_FIND") === "1";

/** The model's answer as one line in a bubble: no thinking, quotes or extra lines, and not too long. */
export function cleanLine(text: string): string | null {
  const line = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim()
    .split("\n")[0]!
    .trim()
    .replace(/^["“'](.*)["”']$/, "$1");
  if (!line) return null;
  return line.length <= LONGEST_LINE ? line : `${line.slice(0, LONGEST_LINE - 1).trimEnd()}…`;
}

export interface LineRequest {
  name: string;
  mode: string;
  /** What the mode means, e.g. "slow and soothing, helping them breathe and focus". */
  style: string;
  alignment: string;
  /** What the alignment means, e.g. "a gleeful little gremlin who cheers for chaos, harmlessly". */
  nature: string;
  /** What just happened, in a sentence, e.g. "The user just patted you." */
  event: string;
  /** Something about the user the pet may bring up, e.g. "They have worked 4 days in a row." */
  fact?: string;
}

export function messagesFor({ name, mode, style, alignment, nature, event, fact }: LineRequest) {
  return [
    {
      role: "system",
      content: `You are ${name}, a tiny cute pet who lives beside a programmer while they work. You are ${alignment}: ${nature}. You are in ${mode} mode: ${style}. Answer with one short sentence, at most 12 words, no quotes, no emoji.`,
    },
    { role: "user", content: fact ? `${event} You know this about them, and may mention it: ${fact}` : event },
  ];
}

/** One sentence from the model, or null when there is no config, the model is slow or unreachable, or it said nothing. */
export async function askForLine(request: LineRequest, config = readConfig(), fetchLine: typeof fetch = fetch): Promise<string | null> {
  if (!config) return null;
  try {
    const response = await fetchLine(`${config.url}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(config.key ? { authorization: `Bearer ${config.key}` } : {}) },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 60,
        temperature: 0.9,
        chat_template_kwargs: { enable_thinking: false },
        messages: messagesFor(request),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
    const content = body.choices?.[0]?.message?.content;
    return content ? cleanLine(content) : null;
  } catch {
    return null;
  }
}
