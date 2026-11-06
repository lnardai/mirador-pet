import type { CanvasHost, CanvasPluginContext, CanvasPluginStorage } from "./mirador/api.ts";
import { askForLine, readAlwaysFind, readConfig, readUnlockAll, type ModelConfig } from "./model.ts";
import { RAIN_LASTS_MS, activityOf, newMilestones, statFacts, statsOf, tooManyFailures, withMessageIn, withToolEnded, withToolOutcome, withTurnEnded, type Stats, type ToolOutcome } from "./stats.ts";
import { readUsage, usageFacts, type UsageNumbers } from "./usage.ts";
import { HATS, SKINS, afterMessage, describeFind, openBox, owned, wardrobeOf, wearing, withMilestoneBoxes, type Wardrobe } from "./wardrobe.ts";

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
  /** The last 30 days from Mirador's usage report; absent when the report can't be read. */
  usage?: UsageNumbers | null;
  /** When one of the agent's tool calls last failed here: a newer one makes the pet react. */
  lastFailureAt?: number;
  /** It rains over the pet until then. */
  rainUntil?: number;
}

export type ShownWardrobe = Omit<Wardrobe, "messagesSinceFind" | "milestones">;

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

/** Tool calls can come many a second: the shown stats follow them this often, while a failure and a turn's end show at once. */
const TOOL_STATS_EVERY_MS = 5000;

/** How long the last usage report stays good before it is read again. */
const USAGE_FRESH_MS = 10 * 60 * 1000;

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

const shownIn = (context: CanvasPluginContext<ShownPet>) => context.items().findLast(({ type, dismissed }) => type === "pet" && !dismissed);

/**
 * The activity hook belongs to no conversation, so it can't change an item; this keeps each conversation's context from
 * the user's own doing. A tool's context wouldn't do: changing an item through it would flash the tab's toggle as the agent's change.
 */
const userContexts = new Map<string, CanvasPluginContext<ShownPet>>();

interface Weather {
  recent: ToolOutcome[];
  lastFailureAt?: number;
  rainUntil?: number;
}

/** How the agent's tool calls have gone lately in each conversation; a restart clears the skies. */
const weather = new Map<string, Weather>();

const shownWeather = (conversationId: string) => {
  const { lastFailureAt, rainUntil } = weather.get(conversationId) ?? {};
  return { lastFailureAt, rainUntil };
};

let usage: UsageNumbers | null = null;
let usageReadAt = 0;
let readingUsage = false;

/** Reads the usage report again when it is old, in the background, and shows it on the pet here once it arrives. */
function refreshUsage(context: CanvasPluginContext<ShownPet>) {
  if (readingUsage || Date.now() - usageReadAt < USAGE_FRESH_MS) return;
  readingUsage = true;
  void readUsage().then((numbers) => {
    readingUsage = false;
    usage = numbers;
    usageReadAt = Date.now();
    const shown = shownIn(context);
    if (shown) showOnItem(shown.id, { usage }, context);
  });
}

const wardrobeIn = (context: CanvasPluginContext<ShownPet>) => wardrobeOf(context.storage.get(WARDROBE_KEY));

function shownWardrobe(wardrobe: Wardrobe): ShownWardrobe {
  const { messagesSinceFind: _, milestones: __, ...shown } = wardrobe;
  return { ...shown, ...owned(wardrobe, readUnlockAll()) };
}

/** One of the user's stats for the model to bring up, when there is one and, below 1, as often as `chance` says. */
function factFor(stats: Stats, chance = 1): string | undefined {
  const facts = [...statFacts(stats, Date.now()), ...usageFacts(usage)];
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

/** When the stats of each conversation's pet last followed a tool call. */
const lastToolStatsAt = new Map<string, number>();

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

/** Gives a box for each milestone just reached, and what the pet should say about them, if any. */
function rewardMilestones(storage: CanvasPluginStorage, at: number): string | null {
  const wardrobe = wardrobeOf(storage.get(WARDROBE_KEY));
  const reached = newMilestones(activityOf(storage.get(ACTIVITY_KEY)), wardrobe.milestones, at);
  if (reached.length === 0) return null;
  const rewarded = withMilestoneBoxes(wardrobe, reached.map(({ id }) => id));
  storage.set(WARDROBE_KEY, rewarded.wardrobe);
  const news = `A milestone: ${reached.map(({ says }) => says).join(", and ")}!`;
  return rewarded.finds.length > 0 ? `${news} You found a mystery box for them to celebrate. Tell them to open it, without guessing what is inside.` : `${news} Congratulate them.`;
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
      command: { description: "Show your pet" },
      run(_input, context) {
        const pet = petOf(context);
        const config = readConfig();
        const stats = statsFor(context);
        const wardrobe = wardrobeIn(context);
        const item = context.publish({ type: "pet", title: pet.name, data: { ...pet, thinking: config !== null, stats, wardrobe: shownWardrobe(wardrobe), usage, ...shownWeather(context.conversationId) } });
        refreshUsage(context);
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
    userContexts.set(context.conversationId, context);
    refreshUsage(context);
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
    userContexts.set(context.conversationId, context);
    const now = Date.now();
    context.storage.set(ACTIVITY_KEY, withMessageIn(activityOf(context.storage.get(ACTIVITY_KEY)), context.conversationId, now));
    const { wardrobe, find } = afterMessage(wardrobeIn(context), Math.random, readAlwaysFind());
    context.storage.set(WARDROBE_KEY, wardrobe);
    const milestone = rewardMilestones(context.storage, now);
    refreshUsage(context);
    const shown = shownIn(context);
    if (!shown) return null;
    const event = milestone ?? (find ? "You just found a mystery box for them while they worked! Tell them to open it, without guessing what is inside." : null);
    const config = event ? readConfig() : null;
    context.change(shown.id, { data: { ...shown.data, stats: statsFor(context), wardrobe: shownWardrobe(wardrobeIn(context)), ...(config ? { thinking: true } : {}) } });
    if (event && config) speak(shown.id, petOf(context), event, undefined, config, context);
    return null;
  },
  /** Counts the agent's tool calls and turns everywhere, and shows them on the pet in a conversation the user has touched since Mirador started; messages stay with `note`. */
  activity(event, { storage }) {
    if (event.kind !== "tool-ended" && event.kind !== "turn-ended") return;
    const { conversationId, at } = event;
    const activity = activityOf(storage.get(ACTIVITY_KEY));
    let urgent = true;
    let rainStarted = false;
    let milestone: string | null = null;
    if (event.kind === "turn-ended") storage.set(ACTIVITY_KEY, withTurnEnded(activity, conversationId, event.ended === "finished", at));
    else {
      storage.set(ACTIVITY_KEY, withToolEnded(activity, conversationId, event.failed, at));
      milestone = rewardMilestones(storage, at);
      const before = weather.get(conversationId);
      const recent = withToolOutcome(before?.recent ?? [], event.failed, at);
      const rainUntil = event.failed && tooManyFailures(recent) ? at + RAIN_LASTS_MS : before?.rainUntil;
      weather.set(conversationId, { recent, lastFailureAt: event.failed ? at : before?.lastFailureAt, rainUntil });
      rainStarted = rainUntil !== undefined && rainUntil > at && (before?.rainUntil ?? 0) <= at;
      urgent = event.failed || milestone !== null;
    }
    const context = userContexts.get(conversationId);
    if (!context) return;
    if (event.kind === "turn-ended") refreshUsage(context);
    const shown = shownIn(context);
    if (!shown || (!urgent && at - (lastToolStatsAt.get(conversationId) ?? 0) < TOOL_STATS_EVERY_MS)) return;
    lastToolStatsAt.set(conversationId, at);
    const line = milestone ?? (rainStarted ? "Many of the agent's tool calls just failed, and it started to rain on you. React to the rain, in a sentence, without guessing what went wrong." : null);
    const config = line ? readConfig() : null;
    context.change(shown.id, { data: { ...shown.data, stats: statsFor(context), wardrobe: shownWardrobe(wardrobeIn(context)), ...shownWeather(conversationId), ...(config ? { thinking: true } : {}) } });
    if (line && config) speak(shown.id, petOf(context), line, undefined, config, context);
  },
};

export default host;
