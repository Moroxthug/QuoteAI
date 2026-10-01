// Pocket 126: pairing the crew's phone. The admin makes a code for one worker; the worker types it on the phone and gets back the personal link token the
// crew screens run on. A code is hashed, lasts 7 days and works once. Crockford base32 without I, L, O, U: nothing to misread on a phone screen.
import { randomBytes } from "node:crypto";

export const PAIRING_DAYS = 7;
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 6; // 30 bits, shown as 123-ABC: the board draws six boxes. One use, 7 days and 20 tries per 15 minutes per address keep it safe.

export function newPairingCode(): string {
  const bytes = randomBytes(LENGTH);
  let out = "";
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[bytes[i]! % 32];
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}

/** What a person typed → the canonical code, or null: case, spaces, dashes and look-alike letters are forgiven. */
export function normalizePairingCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length !== LENGTH || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}
