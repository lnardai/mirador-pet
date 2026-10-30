export type Rarity = "common" | "rare" | "legendary";

/** The hats the pet can find, and how rare each is. The view draws the same ids. */
export const HATS = {
  beanie: { name: "beanie", rarity: "common" },
  cap: { name: "cap", rarity: "common" },
  party: { name: "party hat", rarity: "common" },
  flower: { name: "flower", rarity: "common" },
  top: { name: "top hat", rarity: "rare" },
  beret: { name: "beret", rarity: "rare" },
  chef: { name: "chef's hat", rarity: "rare" },
  viking: { name: "viking helmet", rarity: "rare" },
  wizard: { name: "wizard hat", rarity: "legendary" },
  crown: { name: "crown", rarity: "legendary" },
} as const satisfies Record<string, { name: string; rarity: Rarity }>;

/** The skins, for the body or a hat: colours are common, patterns rare, shimmering ones legendary. The view draws the same ids. */
export const SKINS = {
  ink: { name: "ink skin", rarity: "common" },
  slate: { name: "slate skin", rarity: "common" },
  moss: { name: "moss skin", rarity: "common" },
  plum: { name: "plum skin", rarity: "common" },
  rose: { name: "rose skin", rarity: "common" },
  stripes: { name: "striped skin", rarity: "rare" },
  spots: { name: "spotted skin", rarity: "rare" },
  stars: { name: "starry skin", rarity: "rare" },
  gold: { name: "golden skin", rarity: "legendary" },
  galaxy: { name: "galaxy skin", rarity: "legendary" },
} as const satisfies Record<string, { name: string; rarity: Rarity }>;

export type HatId = keyof typeof HATS;
export type SkinId = keyof typeof SKINS;

export type Find = { kind: "hat"; id: HatId } | { kind: "skin"; id: SkinId };

export interface Wardrobe {
  hats: HatId[];
  skins: SkinId[];
  /** The hat worn, if any. */
  hat: HatId | null;
  /** The hat's skin; null keeps the hat's own colours. */
  hatSkin: SkinId | null;
  bodySkin: SkinId;
  /** Finds still in their boxes, oldest first: what is in them stays out of the wardrobe until the user opens them. */
  boxes: Find[];
  messagesSinceFind: number;
}

/** How likely each rarity is when something is found. */
export const RARITY_WEIGHTS: Record<Rarity, number> = { common: 80, rare: 18, legendary: 2 };

/** The chance each message finds something. */
export const FIND_CHANCE = 1 / 20;

/** A find is certain after this many messages without one, so a dry spell ends. */
export const MESSAGES_UNTIL_SURE_FIND = 50;

const isHat = (id: unknown): id is HatId => typeof id === "string" && Object.hasOwn(HATS, id);
const isSkin = (id: unknown): id is SkinId => typeof id === "string" && Object.hasOwn(SKINS, id);
const isFind = (find: unknown): find is Find => {
  const { kind, id } = (find ?? {}) as { kind?: unknown; id?: unknown };
  return kind === "hat" ? isHat(id) : kind === "skin" && isSkin(id);
};

export const newWardrobe = (): Wardrobe => ({ hats: ["beanie"], skins: ["ink", "slate"], hat: null, hatSkin: null, bodySkin: "ink", boxes: [], messagesSinceFind: 0 });

export function wardrobeOf(stored: unknown): Wardrobe {
  const wardrobe = { ...newWardrobe(), ...(stored as Partial<Wardrobe> | undefined) };
  const hats = Array.isArray(wardrobe.hats) ? wardrobe.hats.filter(isHat) : newWardrobe().hats;
  const skins = Array.isArray(wardrobe.skins) ? wardrobe.skins.filter(isSkin) : newWardrobe().skins;
  return {
    hats,
    skins,
    hat: isHat(wardrobe.hat) ? wardrobe.hat : null,
    hatSkin: isSkin(wardrobe.hatSkin) ? wardrobe.hatSkin : null,
    bodySkin: isSkin(wardrobe.bodySkin) ? wardrobe.bodySkin : "ink",
    boxes: Array.isArray(wardrobe.boxes) ? wardrobe.boxes.filter(isFind) : [],
    messagesSinceFind: typeof wardrobe.messagesSinceFind === "number" ? wardrobe.messagesSinceFind : 0,
  };
}

/** What the user can wear: what they found, or everything when the owner unlocked it all for testing. */
export function owned(wardrobe: Wardrobe, unlockAll: boolean): { hats: HatId[]; skins: SkinId[] } {
  if (unlockAll) return { hats: Object.keys(HATS) as HatId[], skins: Object.keys(SKINS) as SkinId[] };
  return { hats: wardrobe.hats, skins: wardrobe.skins };
}

export const findName = (find: Find) => (find.kind === "hat" ? HATS[find.id] : SKINS[find.id]).name;
export const findRarity = (find: Find): Rarity => (find.kind === "hat" ? HATS[find.id] : SKINS[find.id]).rarity;

/** What is neither in the wardrobe nor in a box yet. */
function unfound(wardrobe: Wardrobe): Find[] {
  const boxed = (find: Find) => wardrobe.boxes.some((box) => box.kind === find.kind && box.id === find.id);
  return [
    ...(Object.keys(HATS) as HatId[]).filter((id) => !wardrobe.hats.includes(id)).map((id): Find => ({ kind: "hat", id })),
    ...(Object.keys(SKINS) as SkinId[]).filter((id) => !wardrobe.skins.includes(id)).map((id): Find => ({ kind: "skin", id })),
  ].filter((find) => !boxed(find));
}

/**
 * Something not found yet: a rarity by its weight among the rarities with something left, then one of that rarity,
 * so legendaries stay as rare once the commons are all found. Null once everything is.
 */
export function pickFind(wardrobe: Wardrobe, random = Math.random): Find | null {
  const left = unfound(wardrobe);
  const weights = (Object.entries(RARITY_WEIGHTS) as [Rarity, number][]).filter(([rarity]) => left.some((find) => findRarity(find) === rarity));
  if (weights.length === 0) return null;
  let roll = random() * weights.reduce((sum, [, weight]) => sum + weight, 0);
  const rarity = weights.find(([, weight]) => (roll -= weight) < 0)?.[0] ?? weights.at(-1)![0];
  const pool = left.filter((find) => findRarity(find) === rarity);
  return pool[Math.floor(random() * pool.length)]!;
}

/** The wardrobe once the user sent a message, with a new box if the message found something; `alwaysFind` is for trying boxes out. */
export function afterMessage(wardrobe: Wardrobe, random = Math.random, alwaysFind = false): { wardrobe: Wardrobe; find: Find | null } {
  const messagesSinceFind = wardrobe.messagesSinceFind + 1;
  const lucky = alwaysFind || messagesSinceFind >= MESSAGES_UNTIL_SURE_FIND || random() < FIND_CHANCE;
  const find = lucky ? pickFind(wardrobe, random) : null;
  if (!find) return { wardrobe: { ...wardrobe, messagesSinceFind }, find: null };
  return { wardrobe: { ...wardrobe, boxes: [...wardrobe.boxes, find], messagesSinceFind: 0 }, find };
}

/** The wardrobe with its oldest box opened, what was in it now found, and what that was. */
export function openBox(wardrobe: Wardrobe): { wardrobe: Wardrobe; find: Find } {
  const [find, ...boxes] = wardrobe.boxes;
  if (!find) throw new Error("There is no box to open.");
  return {
    wardrobe: {
      ...wardrobe,
      hats: find.kind === "hat" && !wardrobe.hats.includes(find.id) ? [...wardrobe.hats, find.id] : wardrobe.hats,
      skins: find.kind === "skin" && !wardrobe.skins.includes(find.id) ? [...wardrobe.skins, find.id] : wardrobe.skins,
      boxes,
    },
    find,
  };
}

export type WearAction = { kind: "wear"; slot: "hat"; id: HatId | null } | { kind: "wear"; slot: "hatSkin"; id: SkinId | null } | { kind: "wear"; slot: "bodySkin"; id: SkinId };

/** The wardrobe with something put on, which must be owned. */
export function wearing(wardrobe: Wardrobe, action: unknown, unlockAll: boolean): Wardrobe {
  const { slot, id } = (action ?? {}) as { slot?: unknown; id?: unknown };
  const { hats, skins } = owned(wardrobe, unlockAll);
  if (slot === "hat" && (id === null || (isHat(id) && hats.includes(id)))) return { ...wardrobe, hat: id };
  if (slot === "hatSkin" && (id === null || (isSkin(id) && skins.includes(id)))) return { ...wardrobe, hatSkin: id };
  if (slot === "bodySkin" && isSkin(id) && skins.includes(id)) return { ...wardrobe, bodySkin: id };
  throw new Error("The pet can only wear a hat or skin it has found.");
}

const article = (word: string) => (/^[aeiou]/.test(word) ? "an" : "a");

/** The find, as the pet's model hears it, e.g. "a legendary crown". */
export function describeFind(find: Find): string {
  const rarity = findRarity(find);
  return `${article(rarity)} ${rarity} ${findName(find)}`;
}
