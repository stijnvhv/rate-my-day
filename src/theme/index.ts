export const C = {
  bg: '#F4F2FA',
  card: '#FFFFFF',
  line: '#ECE8F7',
  ink: '#17142B',
  text: '#3B3755',
  muted: '#7A7592',
  faint: '#B9B4CC',
  primary: '#6C4CF5',
  primaryDark: '#4B2FD1',
  primarySoft: '#EEEAFE',
  coral: '#FF7A6B',
  pink: '#F25FA4',
  amber: '#F5A524',
  green: '#16B286',
  red: '#EF4444',
  sky: '#3BA7F5',
};

export const HERO = ['#5B3DF0', '#8E4CF0', '#F25FA4'] as const;

export const shadow = {
  shadowColor: '#2A1F7A',
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

// Kleur voor een cijfer 1-10: van rood via amber naar groen.
const SCALE = ['#EF4444', '#F2583B', '#F46D33', '#F5852B', '#F5A524', '#D9B21E', '#A8BC26', '#6FBF3B', '#36B85C', '#16B286'];
export function scaleColor(n: number, max = 10): string {
  const i = Math.round(((n - 1) / Math.max(1, max - 1)) * 9);
  return SCALE[Math.min(9, Math.max(0, i))];
}
