import { describe, expect, test } from "bun:test";
import { FOCUS_GAP_MS, activityOf, dayStreak, duration, localDay, newMilestones, noActivity, statFacts, statsOf, tooManyFailures, withMessageIn, withToolEnded, withToolOutcome, withTurnEnded, type Activity, type ToolOutcome, type Totals } from "../stats.ts";

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const MINUTE = 60 * 1000;
const noAgent = { toolCalls: 0, failedTools: 0, turns: 0, stoppedTurns: 0 };

describe("withMessageIn", () => {
  test("counts messages per conversation and the time between close ones as active", () => {
    let activity = noActivity();
    activity = withMessageIn(activity, "a", at(20, 10));
    activity = withMessageIn(activity, "a", at(20, 10, 5));
    activity = withMessageIn(activity, "b", at(20, 10, 6));
    const stats = statsOf(activity, "a", at(20, 11));
    expect(stats.messages).toBe(2);
    expect(stats.firstAt).toBe(at(20, 10));
    expect(stats.activeMs).toBe(5 * MINUTE);
    expect(statsOf(activity, "b", at(20, 11)).messages).toBe(1);
  });

  test("a gap longer than the focus gap ends the streak and isn't active time", () => {
    let activity = noActivity();
    for (const minute of [0, 8, 16]) activity = withMessageIn(activity, "a", at(20, 9, minute));
    activity = withMessageIn(activity, "a", at(20, 9, 16) + FOCUS_GAP_MS + MINUTE);
    activity = withMessageIn(activity, "a", at(20, 9, 16) + FOCUS_GAP_MS + 4 * MINUTE);
    const stats = statsOf(activity, "a", at(20, 12));
    expect(stats.longestStreakMs).toBe(16 * MINUTE);
    expect(stats.activeMs).toBe(19 * MINUTE);
  });

  test("counts messages between midnight and 5 as night owl", () => {
    let activity = noActivity();
    activity = withMessageIn(activity, "a", at(20, 0, 30));
    activity = withMessageIn(activity, "a", at(20, 4, 59));
    activity = withMessageIn(activity, "a", at(20, 5));
    expect(activity.nightOwl).toBe(2);
  });

  test("records each day once", () => {
    let activity = noActivity();
    activity = withMessageIn(activity, "a", at(20, 9));
    activity = withMessageIn(activity, "a", at(20, 18));
    activity = withMessageIn(activity, "a", at(21, 9));
    expect(activity.days).toEqual([localDay(at(20, 9)), localDay(at(21, 9))]);
  });
});

describe("dayStreak", () => {
  const days = [at(25, 9), at(27, 9), at(28, 9), at(29, 9)].map(localDay);

  test("counts days in a row up to today", () => expect(dayStreak(days, at(29, 20))).toBe(3));
  test("still counts a streak that ended yesterday", () => expect(dayStreak(days, at(30, 8))).toBe(3));
  test("is broken by a missed day", () => expect(dayStreak(days, at(31, 8))).toBe(0));
  test("crosses a month's end", () => expect(dayStreak(["2026-09-30", "2026-10-01"], at(1, 12))).toBe(2));
});

test("activityOf survives nothing or junk in storage", () => {
  expect(activityOf(undefined)).toEqual(noActivity());
  expect(activityOf({ days: "nope", nightOwl: "x" })).toEqual(noActivity());
});

test("duration", () => {
  expect(duration(42 * MINUTE)).toBe("42m");
  expect(duration(185 * MINUTE)).toBe("3h 05m");
});

test("statFacts leaves out what isn't worth saying", () => {
  expect(statFacts({ messages: 1, firstAt: at(20, 10), activeMs: 0, longestStreakMs: 0, dayStreak: 1, nightOwl: 0, ...noAgent }, at(20, 10, 5))).toEqual([]);
  expect(statFacts({ messages: 12, firstAt: at(20, 9), activeMs: 0, longestStreakMs: 20 * MINUTE, dayStreak: 4, nightOwl: 3, ...noAgent }, at(20, 10))).toEqual([
    "They have sent 12 messages in this conversation.",
    "They have been in this session for 1h 00m.",
    "Their longest focused stretch here is 20m.",
    "They have worked 4 days in a row.",
    "They have sent 3 messages after midnight.",
  ]);
});

describe("the agent's activity", () => {
  const at = 1_000_000;

  test("tool calls count in the conversation and in the totals, failures apart", () => {
    let activity = noActivity();
    activity = withToolEnded(activity, "a", false, at);
    activity = withToolEnded(activity, "a", true, at);
    activity = withToolEnded(activity, "b", true, at);
    const stats = statsOf(activity, "a", at);
    expect([stats.toolCalls, stats.failedTools]).toEqual([2, 1]);
    expect(activity.totals).toEqual({ messages: 0, toolCalls: 3, failedTools: 2 });
  });

  test("a tool call before any message doesn't count as a message", () => {
    const activity = withToolEnded(noActivity(), "a", false, at);
    expect(statsOf(activity, "a", at).messages).toBe(0);
  });

  test("a turn that didn't finish counts apart", () => {
    const activity = withTurnEnded(withTurnEnded(noActivity(), "a", true, at), "a", false, at);
    const stats = statsOf(activity, "a", at);
    expect([stats.turns, stats.stoppedTurns]).toEqual([2, 1]);
  });

  test("activity stored before these counts reads as none", () => {
    const stats = statsOf(activityOf({ conversations: { a: { messages: 3, firstAt: at, lastAt: at, activeMs: 0, streakStartAt: at, longestStreakMs: 0 } }, days: [], nightOwl: 0 }), "a", at);
    expect([stats.messages, stats.toolCalls, stats.failedTools, stats.turns]).toEqual([3, 0, 0, 0]);
  });

  test("a message after tool calls keeps their counts", () => {
    const activity = withMessageIn(withToolEnded(noActivity(), "a", true, at), "a", at);
    expect(statsOf(activity, "a", at).failedTools).toBe(1);
    expect(activity.totals.messages).toBe(1);
  });
});

describe("rain", () => {
  const outcomes = (failures: number, at = 0) => Array.from({ length: failures }).reduce<ToolOutcome[]>((recent) => withToolOutcome(recent, true, at), []);

  test("starts at five failures among the recent calls", () => {
    expect(tooManyFailures(outcomes(4))).toBe(false);
    expect(tooManyFailures(outcomes(5))).toBe(true);
  });

  test("a long healthy run washes old failures out", () => {
    let recent = outcomes(5);
    for (let index = 0; index < 20; index++) recent = withToolOutcome(recent, false, 0);
    expect(tooManyFailures(recent)).toBe(false);
  });

  test("old failures stop counting after ten minutes", () => {
    const recent = withToolOutcome(outcomes(4), true, 11 * 60 * 1000);
    expect(tooManyFailures(recent)).toBe(false);
  });
});

describe("milestones", () => {
  const withTotals = (totals: Partial<Totals>) => ({ ...noActivity(), totals: { messages: 0, toolCalls: 0, failedTools: 0, ...totals } });
  const ids = (activity: Activity, rewarded: string[] = []) => newMilestones(activity, rewarded, 0).map(({ id }) => id);

  test("are reached by tool calls and messages", () => {
    expect(ids(withTotals({ toolCalls: 99 }))).toEqual([]);
    expect(ids(withTotals({ toolCalls: 100 }))).toEqual(["tools-100"]);
    expect(ids(withTotals({ toolCalls: 1000, messages: 100 }))).toEqual(["tools-100", "tools-1000", "messages-100"]);
  });

  test("reward once", () => {
    expect(ids(withTotals({ toolCalls: 100 }), ["tools-100"])).toEqual([]);
  });

  test("are reached by a streak of days", () => {
    const at = new Date(2026, 10, 7, 12).getTime();
    const days = Array.from({ length: 7 }, (_, index) => localDay(at - index * 24 * 60 * 60 * 1000)).reverse();
    expect(ids({ ...noActivity(), days }).includes("streak-7")).toBe(false);
    expect(newMilestones({ ...noActivity(), days }, [], at).map(({ id }) => id)).toEqual(["streak-7"]);
  });
});
