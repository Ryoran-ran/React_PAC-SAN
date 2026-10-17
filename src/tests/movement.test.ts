import { describe, expect, it } from 'vitest';
import { TILE_CENTER, TILE_SIZE } from '../config/constants';
import { PacSan } from '../entities/PacSan';
import { movePlayer } from '../systems/MovementSystem';

function playerAt(x: number, y: number): PacSan {
  const player = new PacSan();
  player.x = x * TILE_SIZE + TILE_CENTER;
  player.y = y * TILE_SIZE + TILE_CENTER;
  return player;
}

describe('integer-pixel movement', () => {
  it('stops at a wall without drifting through it', () => {
    const player = playerAt(1, 1);
    for (let i = 0; i < 100; i++) movePlayer(player);
    expect(player.x).toBe(12);
    expect(player.y).toBe(12);
    expect(player.moving).toBe(false);
    expect(player.steps).toBe(0);
  });

  it('buffers a turn until the first legal center and never moves diagonally', () => {
    const turning = playerAt(3, 1);
    turning.direction = 'right'; turning.requestedDirection = 'down';
    let prior = { x: turning.x, y: turning.y };
    for (let i = 0; i < 25; i++) {
      movePlayer(turning);
      expect(Math.abs(turning.x - prior.x) + Math.abs(turning.y - prior.y)).toBe(1);
      prior = { x: turning.x, y: turning.y };
    }
    expect(turning.x).toBe(52);
    expect(turning.y).toBe(13);
    expect(turning.direction).toBe('down');
    expect(turning.requestedDirection).toBe('down');
  });

  it('retains a blocked input while continuing forward', () => {
    const player = playerAt(3, 1);
    player.direction = 'right'; player.requestedDirection = 'up';
    for (let i = 0; i < 13; i++) movePlayer(player);
    expect(player.x).toBe(41);
    expect(player.y).toBe(12);
    expect(player.requestedDirection).toBe('up');
  });

  it('reverses immediately between tile centers', () => {
    const player = playerAt(3, 1);
    player.direction = 'right'; player.requestedDirection = 'right';
    movePlayer(player); movePlayer(player); movePlayer(player);
    expect(player.x).toBe(31);
    player.requestedDirection = 'left'; movePlayer(player);
    expect(player.x).toBe(30);
    expect(player.direction).toBe('left');
  });

  it.each(['left', 'right'] as const)('wraps the %s tunnel without a gap', direction => {
    const player = playerAt(0, 14);
    player.direction = direction; player.requestedDirection = direction;
    player.x = direction === 'left' ? 0 : 223;
    movePlayer(player);
    expect(player.x).toBe(direction === 'left' ? 223 : 0);
    expect(player.y).toBe(116);
  });

  it('cannot enter the ghost house through its gate', () => {
    const player = playerAt(13, 11);
    player.direction = 'down'; player.requestedDirection = 'down';
    for (let i = 0; i < 20; i++) movePlayer(player);
    expect(player.y).toBe(92);
  });
});
