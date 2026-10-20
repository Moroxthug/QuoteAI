import { describe, expect, it } from "vitest";
import { isTestAccount } from "./testAccounts";

describe("test accounts", () => {
  it("recognises QA ids and the reserved email domain", () => {
    expect(isTestAccount("e2e_abc")).toBe(true);
    expect(isTestAccount("pocket127-owner")).toBe(true);
    expect(isTestAccount("u_123", "Walk@Example.Invalid")).toBe(true);
  });
  it("leaves real customers alone", () => {
    expect(isTestAccount("u_123", "bob@acme.ca")).toBe(false);
    expect(isTestAccount("my_e2e_user")).toBe(false);
    expect(isTestAccount(null, null)).toBe(false);
  });
});
