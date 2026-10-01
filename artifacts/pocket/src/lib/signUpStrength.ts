// The password meter of SignUp.dc.html: 0 empty, 1 too short, 2 okay (8+ letters only),
// 3 good (8+ with a digit or symbol), 4 strong (14+ with a digit or symbol).
export type Strength = 0 | 1 | 2 | 3 | 4;

export function strength(pass: string): Strength {
  if (!pass.length) return 0;
  if (pass.length < 8) return 1;
  const extra = /[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass);
  if (!extra) return 2;
  return pass.length >= 14 ? 4 : 3;
}
