import { describe, it, expect } from "vitest";
import { buildGmailAuthUrl } from "./gmailSendClient";

describe("buildGmailAuthUrl", () => {
  it("requests only the send-only scope — never readonly/modify (that would require a CASA assessment)", () => {
    const url = new URL(buildGmailAuthUrl("state123"));
    const scope = url.searchParams.get("scope") ?? "";
    expect(scope).toContain("https://www.googleapis.com/auth/gmail.send");
    expect(scope).not.toContain("gmail.readonly");
    expect(scope).not.toContain("gmail.modify");
  });

  it("forces offline access + consent so a refresh token is always returned", () => {
    const url = new URL(buildGmailAuthUrl("state123"));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("passes the state param through unchanged", () => {
    const url = new URL(buildGmailAuthUrl("abc.def.ghi"));
    expect(url.searchParams.get("state")).toBe("abc.def.ghi");
  });
});
