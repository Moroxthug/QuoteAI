import { describe, expect, it } from "vitest";
import { assertPublicHttpsUrl, guardedLookup, isBlockedAddress, UnsafeUrlError } from "./safeFetch.js";

const code = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof UnsafeUrlError ? err.code : String(err);
  }
};

describe("isBlockedAddress", () => {
  it("blocks loopback, private, link-local (cloud metadata), CGNAT and reserved", () => {
    for (const a of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254"]) {
      expect(isBlockedAddress(a), a).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const a of ["8.8.8.8", "172.32.0.1", "142.250.72.14", "2607:f8b0:4004:c07::64"]) {
      expect(isBlockedAddress(a), a).toBe(false);
    }
  });
  it("treats garbage as blocked", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
  });
});

describe("assertPublicHttpsUrl", () => {
  it("accepts a public https URL", () => {
    expect(code(() => assertPublicHttpsUrl("https://calendar.google.com/calendar/ical/x/basic.ics"))).toBeNull();
  });
  it("refuses http, credentials, odd ports, local names and private literals", () => {
    expect(code(() => assertPublicHttpsUrl("http://example.com"))).toBe("HTTPS_REQUIRED");
    expect(code(() => assertPublicHttpsUrl("https://u:p@example.com"))).toBe("NO_CREDENTIALS");
    expect(code(() => assertPublicHttpsUrl("https://example.com:8443/x"))).toBe("BAD_PORT");
    expect(code(() => assertPublicHttpsUrl("https://localhost/x"))).toBe("PRIVATE_HOST");
    expect(code(() => assertPublicHttpsUrl("https://metadata.google.internal/"))).toBe("PRIVATE_HOST");
    expect(code(() => assertPublicHttpsUrl("https://169.254.169.254/latest/meta-data"))).toBe("PRIVATE_HOST");
    expect(code(() => assertPublicHttpsUrl("https://[::1]/"))).toBe("PRIVATE_HOST");
    expect(code(() => assertPublicHttpsUrl("https://0x7f000001/"))).toBe("PRIVATE_HOST");
    expect(code(() => assertPublicHttpsUrl("not a url"))).toBe("INVALID_URL");
  });
  it("refuses, at connect time, a name that resolves to a private address", async () => {
    // The static check never sees the address; the socket's own lookup does.
    const err = await new Promise<unknown>((resolve) => guardedLookup("localhost", {}, (e) => resolve(e)));
    expect(err).toBeInstanceOf(UnsafeUrlError);
  });
});
