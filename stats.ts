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
}

/** What the pet has seen of the user's messages, in every conversation; kept in the plugin's storage. */
export interface Activity {
  conversations: Record<string, ConversationActivity>;
  /** Local dates, YYYY-MM-DD, with at least one message; oldest first. */
  days: string[];
  /** Messages sent between midnight and 5 in the morning. */
  nightOwl: number;
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
}

export const noActivity = (): Activity => ({ conversations: {}, days: [], nightOwl: 0 });

export function activityOf(stored: unknown): Activity {
  const activity = (stored ?? {}) as Partial<Activity>;
  return {
    conversations: activity.conversations ?? {},
    days: Array.isArray(activity.days) ? activity.days : [],
    nightOwl: typeof activity.nightOwl === "number" ? activity.nightOwl : 0,
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

function withMessage(conversation: ConversationActivity | undefined, at: number): ConversationActivity {
  if (!conversation) return { messages: 1, firstAt: at, lastAt: at, activeMs: 0, streakStartAt: at, longestStreakMs: 0 };
  const gap = Math.max(0, at - conversation.lastAt);
  const focused = gap <= FOCUS_GAP_MS;
  const streakStartAt = focused ? conversation.streakStartAt : at;
  return {
    messages: conversation.messages + 1,
    firstAt: conversation.firstAt,
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
  return { conversations, days, nightOwl };
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
  return facts;
}
