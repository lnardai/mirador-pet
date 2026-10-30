import { describe, expect, test } from "bun:test";
import { FOCUS_GAP_MS, activityOf, dayStreak, duration, localDay, noActivity, statFacts, statsOf, withMessageIn } from "../stats.ts";

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const MINUTE = 60 * 1000;

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
  expect(statFacts({ messages: 1, firstAt: at(20, 10), activeMs: 0, longestStreakMs: 0, dayStreak: 1, nightOwl: 0 }, at(20, 10, 5))).toEqual([]);
  expect(statFacts({ messages: 12, firstAt: at(20, 9), activeMs: 0, longestStreakMs: 20 * MINUTE, dayStreak: 4, nightOwl: 3 }, at(20, 10))).toEqual([
    "They have sent 12 messages in this conversation.",
    "They have been in this session for 1h 00m.",
    "Their longest focused stretch here is 20m.",
    "They have worked 4 days in a row.",
    "They have sent 3 messages after midnight.",
  ]);
});
