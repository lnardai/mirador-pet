import type { CanvasHost, CanvasPluginContext } from "./mirador/api.ts";
import { askForLine, readAlwaysFind, readConfig, readUnlockAll, type ModelConfig } from "./model.ts";
import { activityOf, statFacts, statsOf, withMessageIn, type Stats } from "./stats.ts";
import { HATS, SKINS, afterMessage, describeFind, openBox, owned, wardrobeOf, wearing, type Wardrobe } from "./wardrobe.ts";

/** How the pet talks, as the user picks it, and what the model is told each one means. The view lists the same modes. */
export const MODE_STYLES = {
  encouraging: "warm and supportive, telling them they can do it",
  motivating: "energetic, pushing them to take the next step",
  calming: "slow and soothing, helping them breathe and focus",
  quiet: "almost silent: a few gentle words at most",
  playful: "bouncy and silly, making little jokes",
  cheeky: "teasing them lightly, with a wink",
  wise: "calm and thoughtful, like a tiny old sage",
  curious: "full of questions about what they are working on",
  proud: "beaming with pride at what they have done",
  sleepy: "drowsy and yawning, but still sweet",
  grumpy: "adorably grumpy, complaining but caring",
  dramatic: "theatrical, treating small things as epic",
} as const;

export type Mode = keyof typeof MODE_STYLES;

export const MODES = Object.keys(MODE_STYLES) as Mode[];

const isMode = (mode: unknown): mode is Mode => typeof mode === "string" && Object.hasOwn(MODE_STYLES, mode);

/** Who the pet is underneath every mode, D&D style, and what the model is told each one means. The view lists the same alignments. */
export const ALIGNMENT_STYLES = {
  "lawful good": "principled and kind: you love clean code, tests and doing things right",
  "neutral good": "kind and practical: you just want them to be well",
  "chaotic good": "kind but wild: rules are suggestions if it helps them",
  "lawful neutral": "orderly and by the book: conventions matter above all",
  "true neutral": "balanced and unbothered: things are what they are",
  "chaotic neutral": "unpredictable and impulsive: you love a reckless shortcut",
  "lawful evil": "scheming and orderly: you admire ruthless efficiency",
  "neutral evil": "sly and self-serving, in a harmless, cartoonish way",
  "chaotic evil": "a gleeful little gremlin who cheers for chaos, harmlessly",
} as const;

export type Alignment = keyof typeof ALIGNMENT_STYLES;

const isAlignment = (alignment: unknown): alignment is Alignment => typeof alignment === "string" && Object.hasOwn(ALIGNMENT_STYLES, alignment);

export interface Pet {
  name: string;
  mode: Mode;
  alignment: Alignment;
  pats: number;
}

/** The pet as its item shows it: with what it says, from the model, once it answered. */
export interface ShownPet extends Pet {
  line?: string;
  /** Waiting for the model's line: the bubble shows dots. */
  thinking?: boolean;
  /** The user's activity in this conversation, and across them. */
  stats?: Stats;
  /** What the pet wears, and what it can. */
  wardrobe?: ShownWardrobe;
}

export type ShownWardrobe = Omit<Wardrobe, "messagesSinceFind">;

/** The one pet every conversation shares, kept in the plugin's storage. */
const PET_KEY = "pet";

/** The hats and skins found, and what the pet wears; shared by every conversation, like the pet. */
const WARDROBE_KEY = "wardrobe";

/** What the pet has seen of the user's messages, in every conversation. */
const ACTIVITY_KEY = "activity";

/** How often a pat's line may bring up one of the user's stats; opening the pet always may. */
const STAT_IN_PAT_LINE = 1 / 3;

/** Pats closer together than this get no new line, so patting fast doesn't flood the model. */
const PATS_BETWEEN_LINES_MS = 4000;

const newPet = (): Pet => ({ name: "Pip", mode: "encouraging", alignment: "neutral good", pats: 0 });

function petOf(context: CanvasPluginContext<ShownPet>): Pet {
  const pet = { ...newPet(), ...(context.storage.get(PET_KEY) as Partial<Pet> | undefined) };
  return { ...pet, mode: isMode(pet.mode) ? pet.mode : newPet().mode, alignment: isAlignment(pet.alignment) ? pet.alignment : newPet().alignment };
}

type PetAction = { kind: "pat" } | { kind: "mode"; mode: Mode } | { kind: "alignment"; alignment: Alignment };

function changed(pet: Pet, action: unknown): Pet {
  const { kind, mode, alignment } = (action ?? {}) as { kind?: string; mode?: unknown; alignment?: unknown };
  if (kind === "pat") return { ...pet, pats: pet.pats + 1 };
  if (kind === "mode" && isMode(mode)) return { ...pet, mode };
  if (kind === "alignment" && isAlignment(alignment)) return { ...pet, alignment };
  throw new Error(`The pet can only be patted, set to a mode (${MODES.join(", ")}) or set to an alignment (${Object.keys(ALIGNMENT_STYLES).join(", ")}).`);
}

const statsFor = (context: CanvasPluginContext<ShownPet>) => statsOf(activityOf(context.storage.get(ACTIVITY_KEY)), context.conversationId, Date.now());

const wardrobeIn = (context: CanvasPluginContext<ShownPet>) => wardrobeOf(context.storage.get(WARDROBE_KEY));

function shownWardrobe(wardrobe: Wardrobe): ShownWardrobe {
  const { messagesSinceFind: _, ...shown } = wardrobe;
  return { ...shown, ...owned(wardrobe, readUnlockAll()) };
}

/** One of the user's stats for the model to bring up, when there is one and, below 1, as often as `chance` says. */
function factFor(stats: Stats, chance = 1): string | undefined {
  const facts = statFacts(stats, Date.now());
  if (facts.length === 0 || Math.random() >= chance) return undefined;
  return facts[Math.floor(Math.random() * facts.length)];
}

function eventOf(action: unknown, pet: Pet, wardrobe: Wardrobe): string {
  const { kind, slot } = action as { kind?: string; slot?: string };
  if (kind === "wear" && slot === "hat") return wardrobe.hat ? `The user just put a ${HATS[wardrobe.hat].name} on you.` : "The user just took your hat off.";
  if (kind === "wear" && slot === "hatSkin") return wardrobe.hatSkin ? `The user just gave your hat the ${SKINS[wardrobe.hatSkin].name}.` : "The user just gave your hat its own colours back.";
  if (kind === "wear") return `The user just gave you the ${SKINS[wardrobe.bodySkin].name}.`;
  if (kind === "pat") return `The user just patted you (pat number ${pet.pats}).`;
  if (kind === "alignment") return `The user just made you ${pet.alignment}.`;
  return `The user just switched you to ${pet.mode} mode.`;
}

let lastLineAt = 0;

/** The newest question to the model for each item; an older one's answer comes too late to show. */
const newestAsk = new Map<string, number>();
let asks = 0;

function showOnItem(itemId: string, change: Partial<ShownPet>, context: CanvasPluginContext<ShownPet>) {
  const item = context.items().find(({ id }) => id === itemId);
  if (item) context.change(itemId, { data: { ...item.data, ...change } });
}

/**
 * Asks the model for a line in the background, for an item already shown thinking, and puts the answer in its bubble;
 * without one, the bubble keeps what it said before, or the built-in line.
 */
function speak(itemId: string, pet: Pet, event: string, fact: string | undefined, config: ModelConfig, context: CanvasPluginContext<ShownPet>) {
  lastLineAt = Date.now();
  const ask = ++asks;
  newestAsk.set(itemId, ask);
  const request = { name: pet.name, mode: pet.mode, style: MODE_STYLES[pet.mode], alignment: pet.alignment, nature: ALIGNMENT_STYLES[pet.alignment], event, fact };
  void askForLine(request, config).then((line) => {
    if (newestAsk.get(itemId) !== ask) return;
    newestAsk.delete(itemId);
    showOnItem(itemId, line ? { line, thinking: false } : { thinking: false }, context);
  });
}

/** Puts on what the user picked; a new outfit gets a line, as often as a pat does. */
function dress(item: { id: string; data: ShownPet }, action: unknown, context: CanvasPluginContext<ShownPet>) {
  const wardrobe = wearing(wardrobeIn(context), action, readUnlockAll());
  context.storage.set(WARDROBE_KEY, wardrobe);
  const config = Date.now() - lastLineAt >= PATS_BETWEEN_LINES_MS ? readConfig() : null;
  const thinking = config !== null || (item.data.thinking === true && newestAsk.has(item.id));
  context.change(item.id, { data: { ...item.data, wardrobe: shownWardrobe(wardrobe), thinking } });
  if (config) speak(item.id, petOf(context), eventOf(action, petOf(context), wardrobe), undefined, config, context);
  return null;
}

/** Opens the oldest box, which the view shows with its ceremony, and the pet reacts to what was in it. */
function open(item: { id: string; data: ShownPet }, context: CanvasPluginContext<ShownPet>) {
  const { wardrobe, find } = openBox(wardrobeIn(context));
  context.storage.set(WARDROBE_KEY, wardrobe);
  const config = readConfig();
  context.change(item.id, { data: { ...item.data, wardrobe: shownWardrobe(wardrobe), thinking: config !== null } });
  if (config) speak(item.id, petOf(context), `The user just opened the box you found for them, and inside was ${describeFind(find)}! React to it.`, undefined, config, context);
  return null;
}

const host: CanvasHost<ShownPet> = {
  items: {
    pet: {
      icon: "🐾",
      placement: "tab",
      count: (pet) => `♥${pet.pats}`,
      /** A restart cut the model's answer short: the pet stops thinking. */
      listed: (item) => (item.data.thinking && !newestAsk.has(item.id) ? { ...item.data, thinking: false } : item.data),
    },
  },
  tools: {
    pet: {
      description: "Show the user's pet in the tab beside the canvas. Call it when the user asks to see their pet.",
      input: { type: "object", properties: {} },
      run(_input, context) {
        const pet = petOf(context);
        const config = readConfig();
        const stats = statsFor(context);
        const wardrobe = wardrobeIn(context);
        const item = context.publish({ type: "pet", title: pet.name, data: { ...pet, thinking: config !== null, stats, wardrobe: shownWardrobe(wardrobe) } });
        const boxes = wardrobe.boxes.length;
        const event = boxes
          ? `The user just opened your window. While they worked, you found ${boxes === 1 ? "a mystery box" : `${boxes} mystery boxes`} for them. Tell them to open it, without guessing what is inside.`
          : "The user just opened your window to see you.";
        if (config) speak(item.id, pet, event, boxes ? undefined : factFor(stats), config, context);
        return `${pet.name} is in the tab, ${pet.alignment}, in ${pet.mode} mode, patted ${pet.pats} times.`;
      },
    },
  },
  guidance: {
    instructions: "- pet: show the user's pet in the tab beside the canvas when they ask for it.",
  },
  action(item, action, context) {
    const kind = (action as { kind?: unknown } | null)?.kind;
    if (kind === "wear") return dress(item, action, context);
    if (kind === "open") return open(item, context);
    const pet = changed(petOf(context), action);
    context.storage.set(PET_KEY, pet);
    const turned = pet.mode !== item.data.mode || pet.alignment !== item.data.alignment;
    const config = turned || Date.now() - lastLineAt >= PATS_BETWEEN_LINES_MS ? readConfig() : null;
    const thinking = config !== null || (item.data.thinking === true && newestAsk.has(item.id));
    const stats = statsFor(context);
    context.change(item.id, { title: pet.name, data: { ...item.data, ...pet, line: turned ? undefined : item.data.line, thinking, stats } });
    const fact = (action as Partial<PetAction>).kind === "pat" ? factFor(stats, STAT_IN_PAT_LINE) : undefined;
    if (config) speak(item.id, pet, eventOf(action, pet, wardrobeIn(context)), fact, config, context);
    return null;
  },
  /** Counts the user's message, which a turn starting means, maybe finds something, and updates the pet here; the agent hears nothing. */
  note(context) {
    context.storage.set(ACTIVITY_KEY, withMessageIn(activityOf(context.storage.get(ACTIVITY_KEY)), context.conversationId, Date.now()));
    const { wardrobe, find } = afterMessage(wardrobeIn(context), Math.random, readAlwaysFind());
    context.storage.set(WARDROBE_KEY, wardrobe);
    const shown = context.items().findLast(({ type, dismissed }) => type === "pet" && !dismissed);
    if (!shown) return null;
    const config = find ? readConfig() : null;
    context.change(shown.id, { data: { ...shown.data, stats: statsFor(context), wardrobe: shownWardrobe(wardrobe), ...(config ? { thinking: true } : {}) } });
    if (find && config) speak(shown.id, petOf(context), "You just found a mystery box for them while they worked! Tell them to open it, without guessing what is inside.", undefined, config, context);
    return null;
  },
};

export default host;
