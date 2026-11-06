import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { askForLine, cleanLine, configFromForm, parseConfig, readConfig, shownModelSettings, testModel, withConfigIn, writeConfig } from "../model.ts";

describe("parseConfig", () => {
  test("reads the url, model and key, trimming the url's slash and quotes", () => {
    expect(parseConfig('PET_MODEL_URL=http://h:8080/v1/\nexport PET_MODEL="active"\nPET_MODEL_KEY=k')).toEqual({ url: "http://h:8080/v1", model: "active", key: "k" });
  });

  test("is null without a url or a model, and leaves comments out", () => {
    expect(parseConfig("# PET_MODEL_URL=http://h\nPET_MODEL=active")).toBeNull();
  });
});

describe("cleanLine", () => {
  test("drops thinking, quotes and every line after the first", () => {
    expect(cleanLine('<think>hmm</think>\n"You got this!"\nMore.')).toBe("You got this!");
  });

  test("cuts a long line", () => {
    expect(cleanLine("a".repeat(200))!.length).toBe(140);
  });

  test("is null for nothing", () => {
    expect(cleanLine("  <think>x</think> ")).toBeNull();
  });
});

describe("askForLine", () => {
  const config = { url: "http://model/v1", model: "m", key: null };
  const request = { name: "Argus", mode: "calming", style: "slow and soothing", alignment: "chaotic good", nature: "kind but wild", event: "The user just patted you." };

  test("is the model's sentence", async () => {
    const fetchLine = (async () => Response.json({ choices: [{ message: { content: "Breathe, friend." } }] })) as unknown as typeof fetch;
    expect(await askForLine(request, config, fetchLine)).toBe("Breathe, friend.");
  });

  test("is null with no config, a failed request or an unreachable model", async () => {
    const failing = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    const unreachable = (async () => { throw new Error("refused"); }) as unknown as typeof fetch;
    expect(await askForLine(request, null)).toBeNull();
    expect(await askForLine(request, config, failing)).toBeNull();
    expect(await askForLine(request, config, unreachable)).toBeNull();
  });
});

test("messagesFor adds the fact to the event when there is one", async () => {
  const { messagesFor } = await import("../model.ts");
  const request = { name: "Argus", mode: "calming", style: "s", alignment: "true neutral", nature: "n", event: "The user just patted you." };
  expect(messagesFor(request)[1]!.content).toBe("The user just patted you.");
  expect(messagesFor({ ...request, fact: "They have worked 4 days in a row." })[1]!.content).toContain("4 days in a row");
});

describe("the model dialog", () => {
  const saved = { url: "http://a:8080/v1", model: "active", key: "secret-key" };
  const form = (fields: object) => ({ url: saved.url, model: saved.model, key: "", removeKey: false, ...fields });

  test("shows everything but the key", () => {
    expect(shownModelSettings(saved)).toEqual({ url: saved.url, model: "active", keySet: true });
    expect(JSON.stringify(shownModelSettings(saved))).not.toContain("secret-key");
    expect(shownModelSettings(null)).toEqual({ url: "", model: "", keySet: false });
  });

  test("an empty key field keeps the saved key for the same server", () => {
    expect(configFromForm(form({ url: "http://a:8080/other/" }), saved)).toEqual({ url: "http://a:8080/other", model: "active", key: "secret-key" });
  });

  test("the saved key never goes to another server", () => {
    expect(configFromForm(form({ url: "http://b:8080/v1" }), saved)?.key).toBeNull();
    expect(configFromForm(form({ url: "http://a:9090/v1" }), saved)?.key).toBeNull();
  });

  test("a typed key replaces the saved one, and the key can be removed", () => {
    expect(configFromForm(form({ key: " new " }), saved)?.key).toBe("new");
    expect(configFromForm(form({ removeKey: true }), saved)?.key).toBeNull();
  });

  test("empty URL and model mean built-in lines", () => {
    expect(configFromForm({ url: " ", model: "" }, saved)).toBeNull();
  });

  test("refuses half a config, another kind of URL and line breaks", () => {
    expect(() => configFromForm(form({ model: "" }), saved)).toThrow("both");
    expect(() => configFromForm(form({ url: "not a url" }), saved)).toThrow("http://host:8080/v1");
    expect(() => configFromForm(form({ url: "file:///etc/passwd" }), saved)).toThrow("http://host:8080/v1");
    expect(() => configFromForm(form({ key: "a\nPET_UNLOCK_ALL=1" }), saved)).toThrow("line breaks");
  });

  test("saving keeps comments and other settings", () => {
    const text = "# mine\nPET_MODEL_URL=http://old/v1\nPET_UNLOCK_ALL=1\nPET_MODEL=old\n# PET_MODEL_KEY=\n";
    expect(withConfigIn(text, saved)).toBe("# mine\nPET_MODEL_URL=http://a:8080/v1\nPET_UNLOCK_ALL=1\nPET_MODEL=active\n# PET_MODEL_KEY=\nPET_MODEL_KEY=secret-key\n");
    expect(parseConfig(withConfigIn(text, saved))).toEqual(saved);
  });

  test("saving no config or no key takes them out", () => {
    const text = "PET_MODEL_URL=http://old/v1\nPET_MODEL=old\nPET_MODEL_KEY=k\nPET_ALWAYS_FIND=1\n";
    expect(withConfigIn(text, null)).toBe("PET_ALWAYS_FIND=1\n");
    expect(withConfigIn(text, { url: "http://a/v1", model: "m", key: null })).toBe("PET_MODEL_URL=http://a/v1\nPET_MODEL=m\nPET_ALWAYS_FIND=1\n");
  });

  test("the file is only the user's, even one that was readable before", () => {
    const folder = mkdtempSync(join(tmpdir(), "pet-config-"));
    const file = join(folder, "nested", "model.env");
    writeConfig(saved, file);
    expect(readConfig(file)).toEqual(saved);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    chmodSync(file, 0o644);
    writeConfig({ ...saved, model: "other" }, file);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(readdirSync(dirname(file))).toEqual(["model.env"]);
    rmSync(folder, { recursive: true });
  });

  const request = { name: "Argus", mode: "quiet", style: "s", alignment: "true neutral", nature: "n", event: "e" };
  const answering = (status: number, body = "{}") => (async () => new Response(body, { status })) as unknown as typeof fetch;

  test("a test says why it got no line, without repeating the server", async () => {
    expect(await testModel(request, saved, answering(401, "bad secret-key"))).toEqual({ ok: false, problem: "The server refused the API key." });
    expect((await testModel(request, saved, answering(404))).ok).toBe(false);
    expect(await testModel(request, saved, answering(500, "boom"))).toEqual({ ok: false, problem: "The server answered with an error (500)." });
    expect(await testModel(request, saved, answering(200, "<html>"))).toEqual({ ok: false, problem: "That URL doesn't answer like an OpenAI-compatible server." });
    expect(await testModel(request, saved, answering(200))).toEqual({ ok: false, problem: "The model answered with nothing." });
    expect(await testModel(request, saved, (async () => { throw new TypeError("refused"); }) as unknown as typeof fetch)).toEqual({ ok: false, problem: "Can't reach the server." });
  });

  test("a test that works gives the line", async () => {
    const reply = JSON.stringify({ choices: [{ message: { content: "Hello there" } }] });
    expect(await testModel(request, saved, answering(200, reply))).toEqual({ ok: true, line: "Hello there" });
  });
});
