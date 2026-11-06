/** A gap longer than this between two messages ends a focus streak, and doesn't count as active time. */
export const FOCUS_GAP_MS = 10 * 60 * 1000;

/** Conversations kept beyond this many drop the one used longest ago, so storage stays small. */
const CONVERSATIONS_KEPT = 200;

/** Days kept for the streak; a streak longer than this shows as this long. */
const DAYS_KEPT = 400;

export interface ConversationActivity {
  messages: number;
  firstAt: number;
  lastAt: number;
  activeMs: number;
  streakStartAt: number;
  longestStreakMs: number;
  /** Missing from what was stored before the pet counted them. */
  toolCalls?: number;
  failedTools?: number;
  turns?: number;
  stoppedTurns?: number;
}

/** What has happened in every conversation since the pet started counting it, which outlasts conversations dropped from storage. */
export interface Totals {
  messages: number;
  toolCalls: number;
  failedTools: number;
}

/** What the pet has seen of the user's messages, in every conversation; kept in the plugin's storage. */
export interface Activity {
  conversations: Record<string, ConversationActivity>;
  /** Local dates, YYYY-MM-DD, with at least one message; oldest first. */
  days: string[];
  /** Messages sent between midnight and 5 in the morning. */
  nightOwl: number;
  totals: Totals;
}

/** The stats the pet shows for one conversation, as of `at`. */
export interface Stats {
  messages: number;
  /** When the pet saw the first message here; null before one. */
  firstAt: number | null;
  activeMs: number;
  longestStreakMs: number;
  dayStreak: number;
  nightOwl: number;
  toolCalls: number;
  failedTools: number;
  turns: number;
  stoppedTurns: number;
}

const noTotals = (): Totals => ({ messages: 0, toolCalls: 0, failedTools: 0 });

export const noActivity = (): Activity => ({ conversations: {}, days: [], nightOwl: 0, totals: noTotals() });

export function activityOf(stored: unknown): Activity {
  const activity = (stored ?? {}) as Partial<Activity>;
  return {
    conversations: activity.conversations ?? {},
    days: Array.isArray(activity.days) ? activity.days : [],
    nightOwl: typeof activity.nightOwl === "number" ? activity.nightOwl : 0,
    totals: { ...noTotals(), ...activity.totals },
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

export const localDay = (at: number) => {
  const date = new Date(at);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

function dayBefore(day: string) {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return localDay(new Date(year, month - 1, date - 1, 12).getTime());
}

const newConversation = (at: number): ConversationActivity => ({ messages: 0, firstAt: at, lastAt: at, activeMs: 0, streakStartAt: at, longestStreakMs: 0 });

function withMessage(conversation: ConversationActivity | undefined, at: number): ConversationActivity {
  if (!conversation) return { ...newConversation(at), messages: 1 };
  const gap = Math.max(0, at - conversation.lastAt);
  const focused = gap <= FOCUS_GAP_MS;
  const streakStartAt = focused ? conversation.streakStartAt : at;
  return {
    ...conversation,
    messages: conversation.messages + 1,
    lastAt: at,
    activeMs: conversation.activeMs + (focused ? gap : 0),
    streakStartAt,
    longestStreakMs: Math.max(conversation.longestStreakMs, at - streakStartAt),
  };
}

function keptConversations(conversations: Record<string, ConversationActivity>) {
  const entries = Object.entries(conversations);
  if (entries.length <= CONVERSATIONS_KEPT) return conversations;
  return Object.fromEntries(entries.sort(([, a], [, b]) => b.lastAt - a.lastAt).slice(0, CONVERSATIONS_KEPT));
}

/** The activity once the user sent a message in the conversation at `at`. */
export function withMessageIn(activity: Activity, conversationId: string, at: number): Activity {
  const day = localDay(at);
  const days = activity.days.at(-1) === day ? activity.days : [...activity.days, day].slice(-DAYS_KEPT);
  const nightOwl = activity.nightOwl + (new Date(at).getHours() < 5 ? 1 : 0);
  const conversations = keptConversations({ ...activity.conversations, [conversationId]: withMessage(activity.conversations[conversationId], at) });
  return { conversations, days, nightOwl, totals: { ...activity.totals, messages: activity.totals.messages + 1 } };
}

/** The activity once one of the agent's tool calls ended in the conversation. */
export function withToolEnded(activity: Activity, conversationId: string, failed: boolean, at: number): Activity {
  const conversation = activity.conversations[conversationId] ?? newConversation(at);
  const counted = { ...conversation, toolCalls: (conversation.toolCalls ?? 0) + 1, failedTools: (conversation.failedTools ?? 0) + (failed ? 1 : 0) };
  return {
    ...activity,
    conversations: keptConversations({ ...activity.conversations, [conversationId]: counted }),
    totals: { ...activity.totals, toolCalls: activity.totals.toolCalls + 1, failedTools: activity.totals.failedTools + (failed ? 1 : 0) },
  };
}

/** The activity once the agent's turn ended in the conversation; a turn that didn't finish is counted apart too. */
export function withTurnEnded(activity: Activity, conversationId: string, finished: boolean, at: number): Activity {
  const conversation = activity.conversations[conversationId] ?? newConversation(at);
  const counted = { ...conversation, turns: (conversation.turns ?? 0) + 1, stoppedTurns: (conversation.stoppedTurns ?? 0) + (finished ? 0 : 1) };
  return { ...activity, conversations: keptConversations({ ...activity.conversations, [conversationId]: counted }) };
}

export interface ToolOutcome {
  at: number;
  failed: boolean;
}

/** Only the calls this recent and this many count toward rain, so old failures and a long healthy run wash it out. */
const RAIN_WINDOW_MS = 10 * 60 * 1000;
const RAIN_CALLS_WATCHED = 20;
const RAIN_FAILURES = 5;

/** How long it rains after the last failure that brought or kept the rain. */
export const RAIN_LASTS_MS = 5 * 60 * 1000;

export function withToolOutcome(recent: ToolOutcome[], failed: boolean, at: number): ToolOutcome[] {
  return [...recent, { at, failed }].filter((outcome) => at - outcome.at <= RAIN_WINDOW_MS).slice(-RAIN_CALLS_WATCHED);
}

export const tooManyFailures = (recent: ToolOutcome[]) => recent.filter(({ failed }) => failed).length >= RAIN_FAILURES;

export interface Milestone {
  id: string;
  /** What the user or their agents reached, for the pet to tell them. */
  says: string;
  reached(totals: Totals, streak: number): boolean;
}

const toolMilestone = (count: number): Milestone => ({
  id: `tools-${count}`,
  says: `their agents reached ${count} tool calls`,
  reached: ({ toolCalls }) => toolCalls >= count,
});

const messageMilestone = (count: number): Milestone => ({
  id: `messages-${count}`,
  says: `they sent their ${count}th message`,
  reached: ({ messages }) => messages >= count,
});

const streakMilestone = (days: number): Milestone => ({
  id: `streak-${days}`,
  says: `they worked ${days} days in a row`,
  reached: (_, streak) => streak >= days,
});

export const MILESTONES = [toolMilestone(100), toolMilestone(1000), toolMilestone(10000), messageMilestone(100), messageMilestone(1000), streakMilestone(7), streakMilestone(30)];

/** The milestones reached and not yet rewarded. */
export function newMilestones(activity: Activity, rewarded: string[], at: number): Milestone[] {
  const streak = dayStreak(activity.days, at);
  return MILESTONES.filter((milestone) => !rewarded.includes(milestone.id) && milestone.reached(activity.totals, streak));
}

/** Days in a row with a message, up to today; a streak whose last day was yesterday still counts until today ends. */
export function dayStreak(days: string[], at: number): number {
  const today = localDay(at);
  let day = days.at(-1) === today ? today : dayBefore(today);
  let streak = 0;
  for (let index = days.length - 1; index >= 0 && days[index] === day; index--) {
    streak++;
    day = dayBefore(day);
  }
  return streak;
}

export function statsOf(activity: Activity, conversationId: string, at: number): Stats {
  const conversation = activity.conversations[conversationId];
  return {
    messages: conversation?.messages ?? 0,
    firstAt: conversation?.firstAt ?? null,
    activeMs: conversation?.activeMs ?? 0,
    longestStreakMs: conversation?.longestStreakMs ?? 0,
    dayStreak: dayStreak(activity.days, at),
    nightOwl: activity.nightOwl,
    toolCalls: conversation?.toolCalls ?? 0,
    failedTools: conversation?.failedTools ?? 0,
    turns: conversation?.turns ?? 0,
    stoppedTurns: conversation?.stoppedTurns ?? 0,
  };
}

export function duration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`;
}

/** The facts about the user the pet may bring up, as sentences for the model; the empty ones left out. */
export function statFacts(stats: Stats, at: number): string[] {
  const facts: string[] = [];
  if (stats.messages > 1) facts.push(`They have sent ${stats.messages} messages in this conversation.`);
  if (stats.firstAt !== null && at - stats.firstAt >= 15 * 60 * 1000) facts.push(`They have been in this session for ${duration(at - stats.firstAt)}.`);
  if (stats.longestStreakMs >= 15 * 60 * 1000) facts.push(`Their longest focused stretch here is ${duration(stats.longestStreakMs)}.`);
  if (stats.dayStreak >= 2) facts.push(`They have worked ${stats.dayStreak} days in a row.`);
  if (stats.nightOwl > 0) facts.push(`They have sent ${stats.nightOwl} messages after midnight.`);
  if (stats.toolCalls >= 20) facts.push(`Their agent has made ${stats.toolCalls} tool calls in this conversation.`);
  if (stats.failedTools >= 3) facts.push(`${stats.failedTools} of their agent's tool calls have failed in this conversation.`);
  if (stats.stoppedTurns >= 2) facts.push(`${stats.stoppedTurns} of their agent's turns didn't finish in this conversation.`);
  return facts;
}
