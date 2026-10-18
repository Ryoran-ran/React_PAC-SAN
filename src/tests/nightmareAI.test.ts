import { describe, expect, it } from 'vitest';
import { chooseNightmareDirection, planNightmareTargets } from '../ai/NightmareAI';
import { DIRECTIONS, MAZE_COLUMNS, READY_FRAMES, TILE_CENTER, TILE_SIZE, type Direction } from '../config/constants';
import { createGhosts, type TilePoint } from '../entities/Ghost';
import { GameEngine } from '../engine/GameEngine';
import { canGhostEnter } from '../map/tileRules';
import { moveGhost } from '../systems/MovementSystem';

const center = (tile: number) => tile * TILE_SIZE + TILE_CENTER;

describe('Nightmare ghost coordination', () => {
  it('gives the pursuer the player tile and assigns distinct legal interception points', () => {
    const ghosts = createGhosts();
    for (const [index, ghost] of ghosts.entries()) {
      ghost.houseState = 'OUTSIDE';
      ghost.x = center([1, 6, 21, 26][index]);
      ghost.y = center(5);
    }
    const player = { x: center(13), y: center(5), direction: 'right' as const };
    const targets = planNightmareTargets(player, ghosts);

    expect(targets.get('blinky')).toEqual({ x: 13, y: 5 });
    expect(targets.size).toBe(4);
    expect(new Set([...targets.values()].map(({ x, y }) => `${x},${y}`)).size).toBe(4);
    for (const target of targets.values()) expect(canGhostEnter(target.x, target.y)).toBe(true);
  });

  it('follows legal corridors toward a target without reversing at each intersection', () => {
    let tile: TilePoint = { x: 13, y: 11 };
    let direction: Direction = 'left';
    const target = { x: 14, y: 23 };
    let reached = false;
    for (let step = 0; step < 90; step++) {
      if (tile.x === target.x && tile.y === target.y) { reached = true; break; }
      const choice = chooseNightmareDirection(tile, direction, target);
      expect(choice.decision.candidates).toContain(choice.chosen);
      direction = choice.chosen;
      const vector = DIRECTIONS[direction];
      tile = { x: (tile.x + vector.x + MAZE_COLUMNS) % MAZE_COLUMNS, y: tile.y + vector.y };
      expect(canGhostEnter(tile.x, tile.y)).toBe(true);
    }
    expect(reached).toBe(true);
  });

  it('keeps coordinated ghosts inside the maze over a sustained pursuit', () => {
    const ghosts = createGhosts();
    for (const ghost of ghosts) {
      ghost.houseState = 'OUTSIDE';
      ghost.x = center(13);
      ghost.y = center(11);
    }
    const player = { x: center(14), y: center(23), direction: 'left' as const };
    for (let frame = 0; frame < 600; frame++) {
      const targets = planNightmareTargets(player, ghosts);
      for (const ghost of ghosts) {
        ghost.targetTile = targets.get(ghost.id)!;
        moveGhost(ghost, 80, undefined, chooseNightmareDirection);
        if (ghost.x % TILE_SIZE === TILE_CENTER && ghost.y % TILE_SIZE === TILE_CENTER) {
          expect(canGhostEnter(Math.floor(ghost.x / TILE_SIZE), Math.floor(ghost.y / TILE_SIZE)),
            `${ghost.id} left the maze at frame ${frame}`).toBe(true);
        }
      }
    }
    expect(ghosts.every((ghost) => ghost.stepsMoved > 0)).toBe(true);
  });

  it('keeps Nightmare scoring and lives on Arcade rules', () => {
    const engine = new GameEngine();
    engine.configureStart('nightmare');
    engine.showStartPrompt();
    expect(engine.snapshot()).toMatchObject({ state: 'TITLE', gameMode: 'nightmare', lives: 3 });
    engine.start();
    expect(engine.snapshot()).toMatchObject({ state: 'READY', gameMode: 'nightmare', lives: 3 });
    expect(engine.ghosts).toHaveLength(4);

    for (let frame = 0; frame < READY_FRAMES; frame++) engine.update();
    engine.score = 9990;
    engine.player.x = center(2) + 1;
    engine.player.y = center(1);
    engine.player.direction = 'left';
    engine.player.requestedDirection = 'left';
    engine.update();
    expect(engine.score).toBe(10000);
    expect(engine.lives).toBe(4);
    expect(engine.highScore).toBe(10000);

    const ghost = engine.ghosts[0];
    ghost.houseState = 'OUTSIDE';
    ghost.state = 'NORMAL';
    ghost.x = engine.player.x;
    ghost.y = engine.player.y;
    engine.update();
    expect(engine.state).toBe('PLAYER_DYING');
    expect(engine.lives).toBe(3);
  });
});
