import { NORMAL_DOT_POINTS, POWER_DOT_POINTS } from '../config/constants';
import type { Dot } from '../map/maze';

export const pointsForDot = (dot: Dot): number =>
  dot === 'power' ? POWER_DOT_POINTS : NORMAL_DOT_POINTS;
