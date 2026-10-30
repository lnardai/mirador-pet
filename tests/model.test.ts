import { describe, expect, test } from "bun:test";
import { askForLine, cleanLine, parseConfig } from "../model.ts";

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
  const request = { name: "Pip", mode: "calming", style: "slow and soothing", alignment: "chaotic good", nature: "kind but wild", event: "The user just patted you." };

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
  const request = { name: "Pip", mode: "calming", style: "s", alignment: "true neutral", nature: "n", event: "The user just patted you." };
  expect(messagesFor(request)[1]!.content).toBe("The user just patted you.");
  expect(messagesFor({ ...request, fact: "They have worked 4 days in a row." })[1]!.content).toContain("4 days in a row");
});
