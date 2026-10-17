import { PLAYER_START, type Direction } from '../config/constants';

export class PacSan {
  x: number = PLAYER_START.x;
  y: number = PLAYER_START.y;
  direction: Direction = 'left';
  requestedDirection: Direction = 'left';
  freezeFrames = 0;
  movementFrame = 0;
  steps = 0;
  moving = false;
}
