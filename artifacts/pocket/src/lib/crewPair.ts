// The crew's pairing code (api-server crew/pairing.ts): six letters and digits, shown 123-ABC. The server forgives case, spaces, dashes and look-alike letters; the phone keeps
// letters and digits, upper-cased, at most six, so the boxes show what was typed.
export const PAIR_LENGTH = 6;

export function cleanPairing(raw: string | null | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, PAIR_LENGTH);
}

export const formatPairing = (code: string): string => {
  const c = cleanPairing(code);
  return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
};
