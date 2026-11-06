import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

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

/** A test may have to wait for the server to load its model. */
const TEST_TIMEOUT_MS = 30_000;

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

/** The model settings as the dialog gets them: everything but the key, of which it only learns whether there is one. */
export interface ShownModelSettings {
  url: string;
  model: string;
  keySet: boolean;
}

export const shownModelSettings = (config: ModelConfig | null): ShownModelSettings => ({ url: config?.url ?? "", model: config?.model ?? "", keySet: Boolean(config?.key) });

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const isWebUrl = (url: string) => URL.canParse(url) && /^https?:$/.test(new URL(url).protocol);

const HAS_CONTROL_CHARACTER = /[\x00-\x1f\x7f]/;

const typed = (value: unknown, label: string) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (HAS_CONTROL_CHARACTER.test(text)) throw new Error(`${label} can't hold line breaks or control characters.`);
  return text;
};

/**
 * The config the dialog's form asks for, or null with its URL and model both empty, which leaves the pet its built-in lines.
 * An empty key field keeps the saved key, but only for the same server: a key is never sent somewhere new unless typed again.
 */
export function configFromForm(form: unknown, current: ModelConfig | null): ModelConfig | null {
  const { url: rawUrl, model: rawModel, key: rawKey, removeKey } = (form ?? {}) as Record<string, unknown>;
  const url = typed(rawUrl, "The server URL").replace(/\/+$/, "");
  const model = typed(rawModel, "The model");
  const key = typed(rawKey, "The API key");
  if (!url && !model) return null;
  if (!url || !model) throw new Error("Fill in both the server URL and the model, or leave both empty for built-in lines only.");
  if (!isWebUrl(url)) throw new Error("The server URL should look like http://host:8080/v1.");
  if (key) return { url, model, key };
  const sameServer = current !== null && originOf(current.url) === originOf(url);
  return { url, model, key: sameServer && removeKey !== true ? current.key : null };
}

const MODEL_SETTINGS = ["PET_MODEL_URL", "PET_MODEL", "PET_MODEL_KEY"];

/** The settings file's text with the model settings replaced in place; comments and other settings stay. */
export function withConfigIn(text: string, config: ModelConfig | null): string {
  const wanted = new Map<string, string>();
  if (config) {
    wanted.set("PET_MODEL_URL", config.url);
    wanted.set("PET_MODEL", config.model);
    if (config.key) wanted.set("PET_MODEL_KEY", config.key);
  }
  const lines = text.split("\n").flatMap((line) => {
    const name = /^\s*(?:export\s+)?([A-Z_]+)\s*=/.exec(line)?.[1];
    if (!name || !MODEL_SETTINGS.includes(name)) return [line];
    const value = wanted.get(name);
    wanted.delete(name);
    return value === undefined ? [] : [`${name}=${value}`];
  });
  const body = lines.join("\n").replace(/\n+$/, "");
  const added = [...wanted].map(([name, value]) => `${name}=${value}`);
  return `${[...(body ? [body] : []), ...added].join("\n")}\n`;
}

/** Saves the config so only the user can read it, as it may hold a key, and all at once, so a line never reads half a file. */
export function writeConfig(config: ModelConfig | null, file = CONFIG_FILE) {
  const target = existsSync(file) ? realpathSync(file) : file;
  mkdirSync(dirname(target), { recursive: true });
  const text = existsSync(target) ? readFileSync(target, "utf8") : "# Where the Mirador pet gets its lines: an OpenAI-compatible endpoint.\n";
  const written = `${target}.${process.pid}.tmp`;
  writeFileSync(written, withConfigIn(text, config), { mode: 0o600 });
  renameSync(written, target);
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

export type ModelAnswer = { ok: true; line: string } | { ok: false; problem: string };

/** Why a response without a line came back, in words the user can act on; never the server's own text, which could repeat what it was sent. */
function statusProblem(status: number): string {
  if (status === 401 || status === 403) return "The server refused the API key.";
  if (status === 404) return "Nothing answers at that URL, or it doesn't know that model. The URL usually ends in /v1.";
  return `The server answered with an error (${status}).`;
}

async function requestLine(request: LineRequest, config: ModelConfig, fetchLine: typeof fetch, timeoutMs: number): Promise<ModelAnswer> {
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
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { ok: false, problem: statusProblem(response.status) };
    const body = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
    const content = body.choices?.[0]?.message?.content;
    const line = content ? cleanLine(content) : null;
    return line ? { ok: true, line } : { ok: false, problem: "The model answered with nothing." };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return { ok: false, problem: `The server didn't answer within ${timeoutMs / 1000} seconds.` };
    if (error instanceof SyntaxError) return { ok: false, problem: "That URL doesn't answer like an OpenAI-compatible server." };
    return { ok: false, problem: "Can't reach the server." };
  }
}

/** One sentence from the model, or null when there is no config, the model is slow or unreachable, or it said nothing. */
export async function askForLine(request: LineRequest, config = readConfig(), fetchLine: typeof fetch = fetch): Promise<string | null> {
  if (!config) return null;
  const answer = await requestLine(request, config, fetchLine, TIMEOUT_MS);
  return answer.ok ? answer.line : null;
}

/** Asks the model for a line the way the pet does, and says why when it can't get one. */
export function testModel(request: LineRequest, config: ModelConfig, fetchLine: typeof fetch = fetch): Promise<ModelAnswer> {
  return requestLine(request, config, fetchLine, TEST_TIMEOUT_MS);
}
