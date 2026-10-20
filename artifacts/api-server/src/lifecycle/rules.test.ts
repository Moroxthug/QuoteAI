import { describe, expect, it } from "vitest";
import { dueMessages, inSendWindow, localHour, type LifecycleState } from "./rules";

const H = 3_600_000;
const D = 24 * H;
// 2026-10-19 15:00 UTC = 11:00 in Toronto (inside the 8-20 window).
const NOW = new Date("2026-10-19T15:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function state(over: Partial<LifecycleState> = {}): LifecycleState {
  return {
    signupAt: ago(10 * H),
    quoteCount: 0,
    sentQuoteCount: 0,
    firstQuoteAt: null,
    paid: false,
    freeLeft: 3,
    lastActivityAt: ago(H),
    lang: "en",
    timeZone: "America/Toronto",
    sentKeys: [],
    lastSentAt: null,
    optedOut: false,
    testAccount: false,
    ...over,
  };
}

describe("quiet hours", () => {
  it("reads the local hour in the company zone", () => {
    expect(localHour(NOW, "America/Toronto")).toBe(11);
    expect(localHour(NOW, "America/Vancouver")).toBe(8);
    expect(localHour(NOW, "Not/AZone")).toBe(11); // unknown zone counts as Toronto
  });
  it("sends only 8:00 to 20:00 local", () => {
    expect(inSendWindow(new Date("2026-10-19T12:00:00Z"), "America/Toronto")).toBe(true); // 08:00
    expect(inSendWindow(new Date("2026-10-19T11:59:00Z"), "America/Toronto")).toBe(false); // 07:59
    expect(inSendWindow(new Date("2026-10-20T23:59:00Z"), "America/Toronto")).toBe(true); // 19:59
    expect(inSendWindow(new Date("2026-10-20T00:00:00Z"), "America/Toronto")).toBe(false); // 20:00 the evening before
  });
  it("does not send at night, and the same instant can be fine in another zone", () => {
    const night = new Date("2026-10-20T02:00:00Z"); // 22:00 Toronto, 19:00 Vancouver
    expect(dueMessages(state(), night)).toBeNull();
    expect(dueMessages(state({ timeZone: "America/Vancouver" }), night)).toBe("welcome");
  });
});

describe("welcome", () => {
  it("is due right after sign-up", () => expect(dueMessages(state(), NOW)).toBe("welcome"));
  it("is not sent to an account that signed up long ago", () => expect(dueMessages(state({ signupAt: ago(5 * D) }), NOW)).not.toBe("welcome"));
  it("goes to paid accounts too", () => expect(dueMessages(state({ paid: true, freeLeft: null }), NOW)).toBe("welcome"));
});

describe("day1_no_quote", () => {
  const base = { sentKeys: ["welcome"], lastSentAt: ago(25 * H), signupAt: ago(26 * H) };
  it("is due 24 h after sign-up with zero quotes", () => expect(dueMessages(state(base), NOW)).toBe("day1_no_quote"));
  it("waits for 24 h", () => expect(dueMessages(state({ ...base, signupAt: ago(20 * H), lastSentAt: ago(19 * H) }), NOW)).toBeNull());
  it("is not due once a quote exists", () => expect(dueMessages(state({ ...base, quoteCount: 1, sentQuoteCount: 1, freeLeft: 2, firstQuoteAt: ago(3 * H) }), NOW)).toBeNull());
});

describe("first_quote_done", () => {
  const base = { sentKeys: ["welcome"], lastSentAt: ago(30 * H), quoteCount: 1, freeLeft: 2, firstQuoteAt: ago(2 * H) };
  it("nudges when a quote exists and none was sent", () => expect(dueMessages(state(base), NOW)).toBe("first_quote_done"));
  it("gives an hour to finish first", () => expect(dueMessages(state({ ...base, firstQuoteAt: ago(20 * 60_000) }), NOW)).toBeNull());
  it("is not needed once a quote was sent to a client", () => expect(dueMessages(state({ ...base, sentQuoteCount: 1 }), NOW)).toBeNull());
});

describe("free quotes", () => {
  const base = { sentKeys: ["welcome", "first_quote_done"], lastSentAt: ago(30 * H), signupAt: ago(3 * D), lastActivityAt: ago(H), quoteCount: 2, sentQuoteCount: 1, firstQuoteAt: ago(2 * D) };
  it("free_quotes_low at exactly 1 left", () => expect(dueMessages(state({ ...base, freeLeft: 1 }), NOW)).toBe("free_quotes_low"));
  it("not at 2 left", () => expect(dueMessages(state({ ...base, freeLeft: 2 }), NOW)).toBeNull());
  it("free_quotes_used at 0 left", () => expect(dueMessages(state({ ...base, freeLeft: 0 }), NOW)).toBe("free_quotes_used"));
  it("never to a paid account", () => {
    expect(dueMessages(state({ ...base, paid: true, freeLeft: null }), NOW)).toBeNull();
    expect(dueMessages(state({ ...base, paid: true, freeLeft: 0 }), NOW)).toBeNull();
    expect(dueMessages(state({ ...base, paid: true, freeLeft: 1 }), NOW)).toBeNull();
  });
  it("not again once sent", () => {
    expect(dueMessages(state({ ...base, freeLeft: 1, sentKeys: [...base.sentKeys, "free_quotes_low"] }), NOW)).toBeNull();
    expect(dueMessages(state({ ...base, freeLeft: 0, sentKeys: [...base.sentKeys, "free_quotes_used"] }), NOW)).toBeNull();
  });
});

describe("inactivity", () => {
  const base = { signupAt: ago(20 * D), sentKeys: ["welcome", "day1_no_quote"], lastSentAt: ago(15 * D), quoteCount: 1, sentQuoteCount: 1, freeLeft: 2, firstQuoteAt: ago(19 * D) };
  it("day7_inactive after 7 idle days", () => expect(dueMessages(state({ ...base, lastActivityAt: ago(8 * D) }), NOW)).toBe("day7_inactive"));
  it("not before 7 idle days", () => expect(dueMessages(state({ ...base, lastActivityAt: ago(6 * D) }), NOW)).toBeNull());
  it("win_back after 30 idle days", () => expect(dueMessages(state({ ...base, signupAt: ago(45 * D), lastActivityAt: ago(31 * D) }), NOW)).toBe("win_back"));
  it("a 35-day idle account gets win_back, not day7", () => expect(dueMessages(state({ ...base, signupAt: ago(45 * D), lastActivityAt: ago(35 * D) }), NOW)).toBe("win_back"));
  it("never to a paid account", () => {
    expect(dueMessages(state({ ...base, paid: true, freeLeft: null, lastActivityAt: ago(8 * D) }), NOW)).toBeNull();
    expect(dueMessages(state({ ...base, paid: true, freeLeft: null, signupAt: ago(45 * D), lastActivityAt: ago(40 * D) }), NOW)).toBeNull();
  });
  it("not twice", () => {
    expect(dueMessages(state({ ...base, lastActivityAt: ago(8 * D), sentKeys: [...base.sentKeys, "day7_inactive"] }), NOW)).toBeNull();
    expect(dueMessages(state({ ...base, signupAt: ago(45 * D), lastActivityAt: ago(31 * D), sentKeys: [...base.sentKeys, "win_back"] }), NOW)).toBeNull();
  });
});

describe("caps and exclusions", () => {
  it("at most one email per 24 h", () => {
    expect(dueMessages(state({ lastSentAt: ago(23 * H) }), NOW)).toBeNull();
    expect(dueMessages(state({ lastSentAt: ago(24 * H) }), NOW)).toBe("welcome");
  });
  it("returns a single key even when several are due", () => {
    const s = state({ signupAt: ago(26 * H) });
    expect(dueMessages(s, NOW)).toBe("welcome");
  });
  it("each key at most once (dedupe)", () => expect(dueMessages(state({ sentKeys: ["welcome"], lastSentAt: ago(2 * D) }), NOW)).toBeNull());
  it("an opted-out person gets nothing", () => expect(dueMessages(state({ optedOut: true }), NOW)).toBeNull());
  it("a test account gets nothing", () => expect(dueMessages(state({ testAccount: true }), NOW)).toBeNull());
});
