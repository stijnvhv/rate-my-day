import { scaleColor } from '../theme';

export function scoreColor(score: number): string {
  return scaleColor(score, 10);
}
