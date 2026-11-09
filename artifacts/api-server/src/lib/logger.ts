import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const PERSONAL_FIELDS = ["to", "toEmail", "email", "clientEmail", "clientName", "phone", "from", "recipient"];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Personal data never reaches the log store (audit B13): email addresses,
  // phone numbers and client names are censored at the top level and one
  // level down. Log an id (userId, quoteId, Resend message id) instead.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "res.headers['set-auth-token']",
      ...PERSONAL_FIELDS,
      ...PERSONAL_FIELDS.map((f) => `*.${f}`),
    ],
    censor: "[redacted]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
