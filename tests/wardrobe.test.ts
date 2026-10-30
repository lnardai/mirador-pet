import { describe, expect, test } from "bun:test";
import { HATS, MESSAGES_UNTIL_SURE_FIND, SKINS, afterMessage, describeFind, newWardrobe, openBox, pickFind, wardrobeOf, wearing, type HatId, type SkinId } from "../wardrobe.ts";

/** A random source that returns these values in turn. */
const rolls = (...values: number[]) => () => values.shift() ?? 0;

const allHats = Object.keys(HATS) as HatId[];
const allSkins = Object.keys(SKINS) as SkinId[];

describe("wardrobeOf", () => {
  test("starts with a beanie and two common skins", () => expect(wardrobeOf(undefined)).toEqual(newWardrobe()));
  test("drops what isn't in the catalogue", () => {
    const wardrobe = wardrobeOf({ hats: ["crown", "sombrero"], skins: "x", hat: "sombrero", bodySkin: "neon", boxes: [{ kind: "hat", id: "sombrero" }, { kind: "skin", id: "gold" }] });
    expect(wardrobe.hats).toEqual(["crown"]);
    expect(wardrobe.skins).toEqual(newWardrobe().skins);
    expect(wardrobe.hat).toBeNull();
    expect(wardrobe.bodySkin).toBe("ink");
    expect(wardrobe.boxes).toEqual([{ kind: "skin", id: "gold" }]);
  });
});

describe("pickFind", () => {
  test("rolls the rarity by weight, then one of that rarity", () => {
    expect(pickFind(newWardrobe(), rolls(0.1, 0))).toEqual({ kind: "hat", id: "cap" });
    expect(pickFind(newWardrobe(), rolls(0.85, 0))).toEqual({ kind: "hat", id: "top" });
    expect(pickFind(newWardrobe(), rolls(0.99, 0.99))).toEqual({ kind: "skin", id: "galaxy" });
  });

  test("once the commons are all found, rolls between the rarities left by their weights", () => {
    const commonsFound = { ...newWardrobe(), hats: allHats.filter((id) => HATS[id].rarity === "common"), skins: allSkins.filter((id) => SKINS[id].rarity === "common") };
    expect(pickFind(commonsFound, rolls(0.5, 0))).toEqual({ kind: "hat", id: "top" });
    expect(pickFind(commonsFound, rolls(0.95, 0))).toEqual({ kind: "hat", id: "wizard" });
  });

  test("doesn't find what is already waiting in a box", () => {
    const allButCap = { ...newWardrobe(), hats: allHats.filter((id) => id !== "cap"), skins: allSkins };
    expect(pickFind(allButCap)).toEqual({ kind: "hat", id: "cap" });
    expect(pickFind({ ...allButCap, boxes: [{ kind: "hat", id: "cap" }] })).toBeNull();
  });

  test("finds nothing once everything is found", () => expect(pickFind({ ...newWardrobe(), hats: allHats, skins: allSkins })).toBeNull());
});

describe("afterMessage", () => {
  test("mostly finds nothing, and counts the dry spell", () => {
    const { wardrobe, find } = afterMessage(newWardrobe(), rolls(0.5));
    expect(find).toBeNull();
    expect(wardrobe.messagesSinceFind).toBe(1);
  });

  test("a lucky roll finds a box, which keeps what is in it out of the wardrobe until opened", () => {
    const { wardrobe, find } = afterMessage(newWardrobe(), rolls(0.01, 0.1, 0));
    expect(find).toEqual({ kind: "hat", id: "cap" });
    expect(wardrobe.boxes).toEqual([{ kind: "hat", id: "cap" }]);
    expect(wardrobe.hats).not.toContain("cap");
    expect(wardrobe.messagesSinceFind).toBe(0);
  });

  test("always finds a box when asked to, for trying boxes out", () => {
    expect(afterMessage(newWardrobe(), rolls(0.99, 0.1, 0), true).find).not.toBeNull();
  });

  test("a long dry spell always ends in a find", () => {
    const { find } = afterMessage({ ...newWardrobe(), messagesSinceFind: MESSAGES_UNTIL_SURE_FIND - 1 }, rolls(0.99, 0.1, 0));
    expect(find).not.toBeNull();
  });
});

describe("openBox", () => {
  test("opens the oldest box and puts what was in it in the wardrobe", () => {
    const { wardrobe, find } = openBox({ ...newWardrobe(), boxes: [{ kind: "skin", id: "gold" }, { kind: "hat", id: "crown" }] });
    expect(find).toEqual({ kind: "skin", id: "gold" });
    expect(wardrobe.skins).toContain("gold");
    expect(wardrobe.boxes).toEqual([{ kind: "hat", id: "crown" }]);
  });

  test("refuses when there is no box", () => expect(() => openBox(newWardrobe())).toThrow());
});

describe("wearing", () => {
  const wardrobe = newWardrobe();

  test("puts on what was found", () => expect(wearing(wardrobe, { kind: "wear", slot: "hat", id: "beanie" }, false).hat).toBe("beanie"));

  test("takes a hat off and gives a hat its own colours back", () => {
    expect(wearing({ ...wardrobe, hat: "beanie" }, { kind: "wear", slot: "hat", id: null }, false).hat).toBeNull();
    expect(wearing({ ...wardrobe, hatSkin: "slate" }, { kind: "wear", slot: "hatSkin", id: null }, false).hatSkin).toBeNull();
  });

  test("refuses what wasn't found, unless everything is unlocked", () => {
    expect(() => wearing(wardrobe, { kind: "wear", slot: "hat", id: "crown" }, false)).toThrow();
    expect(() => wearing(wardrobe, { kind: "wear", slot: "bodySkin", id: null }, false)).toThrow();
    expect(wearing(wardrobe, { kind: "wear", slot: "bodySkin", id: "galaxy" }, true).bodySkin).toBe("galaxy");
  });
});

test("describeFind", () => {
  expect(describeFind({ kind: "hat", id: "crown" })).toBe("a legendary crown");
  expect(describeFind({ kind: "skin", id: "stripes" })).toBe("a rare striped skin");
});
