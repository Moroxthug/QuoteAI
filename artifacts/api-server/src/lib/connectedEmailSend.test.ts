import { describe, it, expect, vi, beforeEach } from "vitest";

const sendGmailMessage = vi.fn();
const getValidEmailAccessToken = vi.fn();
const markEmailSendResult = vi.fn();
const resendSend = vi.fn();

vi.mock("./gmailSendClient.js", () => ({ sendGmailMessage: (...args: unknown[]) => sendGmailMessage(...args) }));
vi.mock("../emailConnections/service.js", () => ({
  getValidEmailAccessToken: (...args: unknown[]) => getValidEmailAccessToken(...args),
  markEmailSendResult: (...args: unknown[]) => markEmailSendResult(...args),
}));
vi.mock("./emailUtils.js", () => ({
  resendOrThrow: () => ({ emails: { send: (...args: unknown[]) => resendSend(...args) } }),
  sanitizeForFromHeader: (v: string) => v,
}));

const { sendCustomerEmail } = await import("./connectedEmailSend");

const baseParams = { userId: "u1", toEmail: "client@example.com", fromDisplayName: "Acme Co", subject: "Hi", html: "<p>hi</p>" };

describe("sendCustomerEmail", () => {
  beforeEach(() => {
    sendGmailMessage.mockReset();
    getValidEmailAccessToken.mockReset();
    markEmailSendResult.mockReset();
    resendSend.mockReset();
  });

  it("sends via the connected Gmail account when one is enabled, and never touches Resend", async () => {
    getValidEmailAccessToken.mockResolvedValue({ accessToken: "tok", accountEmail: "contractor@gmail.com" });
    sendGmailMessage.mockResolvedValue(undefined);

    await sendCustomerEmail(baseParams);

    expect(sendGmailMessage).toHaveBeenCalledTimes(1);
    expect(resendSend).not.toHaveBeenCalled();
    expect(markEmailSendResult).toHaveBeenCalledWith("u1", "google", null);
  });

  it("falls back to Resend when there is no connected account", async () => {
    getValidEmailAccessToken.mockResolvedValue(null);

    await sendCustomerEmail(baseParams);

    expect(sendGmailMessage).not.toHaveBeenCalled();
    expect(resendSend).toHaveBeenCalledTimes(1);
  });

  it("falls back to Resend — rather than dropping the email — when the connected Gmail send fails", async () => {
    getValidEmailAccessToken.mockResolvedValue({ accessToken: "tok", accountEmail: "contractor@gmail.com" });
    sendGmailMessage.mockRejectedValue(new Error("Gmail send failed: 401"));

    await sendCustomerEmail(baseParams);

    expect(sendGmailMessage).toHaveBeenCalledTimes(1);
    expect(resendSend).toHaveBeenCalledTimes(1);
    expect(markEmailSendResult).toHaveBeenCalledWith("u1", "google", "Gmail send failed: 401");
  });

  it("sets Reply-To on the Resend fallback path when provided", async () => {
    getValidEmailAccessToken.mockResolvedValue(null);

    await sendCustomerEmail({ ...baseParams, replyTo: "owner@acme.ca" });

    expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "owner@acme.ca" }));
  });
});
