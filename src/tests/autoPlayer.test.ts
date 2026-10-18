import { describe, expect, it } from 'vitest';
import { chooseAutoDirection, type AutoPlayLevel } from '../ai/AutoPlayer';
import { READY_FRAMES, TILE_CENTER, TILE_SIZE } from '../config/constants';
import { GameEngine } from '../engine/GameEngine';
import { createGhosts } from '../entities/Ghost';
import { PacSan } from '../entities/PacSan';
import { Maze, tileIndex } from '../map/maze';

const at = (tile: number) => tile * TILE_SIZE + TILE_CENTER;

describe('debug auto-play', () => {
  it('chooses a different route when a stronger level anticipates a nearby ghost', () => {
    const player = new PacSan();
    player.x = at(6);
    player.y = at(5);
    const maze = new Maze();
    maze.dots.clear();
    maze.dots.set(tileIndex(5, 5), 'normal');
    maze.dots.set(tileIndex(8, 5), 'normal');
    const ghost = createGhosts()[0];
    ghost.x = at(3);
    ghost.y = at(5);
    ghost.direction = 'right';

    expect(chooseAutoDirection(player, [ghost], maze, 'beginner')?.direction).toBe('left');
    expect(chooseAutoDirection(player, [ghost], maze, 'tas')?.direction).toBe('right');
  });

  it('keeps the chosen dot as its route goal when the maze is sparse and safe', () => {
    const player = new PacSan();
    player.x = at(6);
    player.y = at(5);
    const maze = new Maze();
    maze.dots.clear();
    maze.dots.set(tileIndex(5, 5), 'normal');
    maze.dots.set(tileIndex(8, 5), 'normal');

    const decision = chooseAutoDirection(player, [], maze, 'tas', {
      round: 1, frightenedFramesRemaining: 0, committedTarget: { x: 8, y: 5 },
    });
    expect(decision).toEqual({ direction: 'right', target: { x: 8, y: 5 } });
  });

  it('takes reachable fruit while the frightened window covers the trip', () => {
    const player = new PacSan();
    player.x = at(12);
    player.y = at(17);
    const maze = new Maze();
    maze.dots.clear();
    maze.dots.set(tileIndex(1, 1), 'normal');

    expect(chooseAutoDirection(player, [], maze, 'tas', {
      round: 1, frightenedFramesRemaining: 180,
      fruit: { visible: true, framesRemaining: 300, points: 100 },
    })).toEqual({ direction: 'right', target: { x: 14, y: 17 } });
  });

  it('takes nearby fruit without a power cookie when no ghost can contest it', () => {
    const player = new PacSan();
    player.x = at(12);
    player.y = at(17);
    const maze = new Maze();
    maze.dots.clear();
    maze.dots.set(tileIndex(1, 1), 'normal');

    expect(chooseAutoDirection(player, [], maze, 'tas', {
      round: 4, frightenedFramesRemaining: 0,
      fruit: { visible: true, framesRemaining: 300, points: 500 },
    })).toEqual({ direction: 'right', target: { x: 14, y: 17 } });
  });

  it('leaves a cleared vertical corridor instead of reversing back into it', () => {
    // Reduced state from the recorded round-4 loop at (6,20)-(6,21).
    const remaining = [
      29, 30, 31, 32, 33, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54,
      57, 71, 77, 82, 85, 99, 105, 110, 113, 127, 133, 138, 141, 142, 143,
      144, 145, 147, 148, 149, 150, 151, 155, 156, 157, 158, 159, 160,
      161, 162, 163, 164, 165, 166, 169, 177, 186, 189, 194, 197, 205,
      214, 217, 222, 225, 226, 227, 228, 229, 233, 234, 235, 236, 239,
      240, 241, 242, 245, 246, 247, 248, 249, 250, 273, 301, 329, 357,
      385, 426, 454, 482, 561, 562, 563, 564, 565, 589, 617, 645, 646,
      647, 660, 675, 703, 825, 826,
    ];
    const maze = new Maze();
    for (const index of maze.dots.keys()) {
      if (!remaining.includes(index)) maze.dots.delete(index);
    }
    const player = new PacSan();
    player.x = at(6);
    player.y = at(20);
    player.direction = 'down';
    const ghosts = createGhosts();
    ghosts[0].x = 52;
    ghosts[0].y = 81;
    ghosts[0].direction = 'up';
    ghosts[1].x = 108;
    ghosts[1].y = 113;
    ghosts[2].x = 92;
    ghosts[2].y = 119;
    ghosts[3].x = 124;
    ghosts[3].y = 119;

    expect(chooseAutoDirection(player, ghosts, maze, 'tas', {
      round: 4, frightenedFramesRemaining: 0,
      committedTarget: { x: 1, y: 22 },
    })?.direction).toBe('left');
  });

  it('turns out of a corridor when a faster ghost is catching up from behind', () => {
    // Round-5 frame 18042: Blinky is eleven pixels behind and gains speed.
    const maze = new Maze();
    const remaining = new Set([
      50, 51, 52, 53, 54, 82, 85, 110, 113, 138, 235, 236, 239,
      663, 664, 825, 826,
    ]);
    for (const index of maze.dots.keys()) {
      if (!remaining.has(index)) maze.dots.delete(index);
    }
    const player = new PacSan();
    player.x = at(6);
    player.y = at(8);
    player.direction = 'down';
    const ghosts = createGhosts();
    const positions = [
      { x: 52, y: 57, direction: 'down', target: { x: 6, y: 8 } },
      { x: 91, y: 44, direction: 'left', target: { x: 6, y: 12 } },
      { x: 77, y: 44, direction: 'left', target: { x: 6, y: 13 } },
      { x: 139, y: 140, direction: 'left', target: { x: 6, y: 8 } },
    ] as const;
    ghosts.forEach((ghost, index) => {
      ghost.x = positions[index].x;
      ghost.y = positions[index].y;
      ghost.direction = positions[index].direction;
      ghost.targetTile = positions[index].target;
      ghost.houseState = 'OUTSIDE';
    });

    expect(chooseAutoDirection(player, ghosts, maze, 'tas', {
      round: 5, frightenedFramesRemaining: 0, elroyStage: 2,
      committedTarget: { x: 6, y: 8 },
    })?.direction).toBe('left');
  });

  it.each(['beginner', 'standard', 'expert', 'tas'] as AutoPlayLevel[])(
    '%s collects dots in the real maze without getting stuck', (level) => {
      const engine = new GameEngine();
      engine.toggleDebug();
      engine.setAutoPlayLevel(level);
      engine.start();
      for (let frame = 0; frame < READY_FRAMES + 800; frame++) engine.update();
      expect(engine.maze.remainingDots).toBeLessThan(230);
      expect(engine.autoPlayTarget).not.toBeNull();
      expect(engine.autoPlayLevel).toBe(level);
    },
  );

  it('uses one deterministic path for identical state and inputs', () => {
    const a = new GameEngine();
    const b = new GameEngine();
    for (const engine of [a, b]) {
      engine.toggleDebug();
      engine.setAutoPlayLevel('tas');
      engine.start();
    }
    for (let frame = 0; frame < READY_FRAMES + 500; frame++) { a.update(); b.update(); }
    expect(a.snapshot()).toEqual(b.snapshot());
    expect([...a.maze.dots]).toEqual([...b.maze.dots]);
  });

  it('TAS clears four rounds while using power cookies', () => {
    const engine = new GameEngine();
    engine.toggleDebug();
    engine.setAutoPlayLevel('tas');
    engine.setHistoryRecording(true);
    engine.start();
    let deaths = 0;
    let previousLives = engine.lives;
    for (let frame = 0; frame < 20000 && engine.level < 5
      && engine.state !== 'GAME_OVER'; frame++) {
      engine.update();
      if (engine.lives < previousLives) deaths += previousLives - engine.lives;
      previousLives = engine.lives;
    }
    const events = engine.history.exportData().events;
    const decisions = events.filter(event => event.kind === 'auto_decision');
    let alternating = 0;
    let longestAlternation = 0;
    let longestAt = 0;
    for (let i = 2; i < decisions.length; i++) {
      const current = decisions[i].detail;
      const previous = decisions[i - 1].detail;
      const beforePrevious = decisions[i - 2].detail;
      if (current.x === beforePrevious.x && current.y === beforePrevious.y
        && (current.x !== previous.x || current.y !== previous.y)) {
        alternating++;
        if (alternating > longestAlternation) {
          longestAlternation = alternating;
          longestAt = i;
        }
      } else alternating = 0;
    }
    const loop = decisions[longestAt];
    expect(longestAlternation,
      `repeated near (${loop?.detail.x},${loop?.detail.y}) at frame ${loop?.frame}`)
      .toBeLessThan(8);
    expect(engine.level,
      `state=${engine.state} lives=${engine.lives} dots=${engine.maze.remainingDots} deaths=${deaths}`)
      .toBeGreaterThanOrEqual(5);
    // Corrected upward ghost targeting changes their routes during long runs.
    // Keep a bounded-death check and the specific old waiting-loop regression.
    expect(deaths).toBeLessThanOrEqual(2);
    expect(events.filter(event => event.kind === 'life_lost'
      && event.detail.x === 124 && event.detail.y === 212)).toHaveLength(0);
    expect(events.filter(event => event.kind === 'ghost_eaten').length).toBeGreaterThanOrEqual(10);
    expect(engine.score).toBeGreaterThanOrEqual(14000);
  }, 30000);

  it('TAS gets through the sixth round while forecasting ghosts leaving home', () => {
    const engine = new GameEngine();
    engine.toggleDebug();
    engine.setAutoPlayLevel('tas');
    engine.start();
    for (let frame = 0; frame < 30000 && engine.level < 7
      && engine.state !== 'GAME_OVER'; frame++) engine.update();
    expect(engine.level,
      `state=${engine.state} lives=${engine.lives} dots=${engine.maze.remainingDots} score=${engine.score}`)
      .toBeGreaterThanOrEqual(7);
  }, 30000);

  it.each(['beginner', 'standard', 'expert', 'tas'] as AutoPlayLevel[])(
    '%s can finish a full round autonomously', (level) => {
    const engine = new GameEngine();
    engine.toggleDebug();
    engine.setAutoPlayLevel(level);
    engine.start();
    for (let frame = 0; frame < 20000 && engine.state !== 'LEVEL_CLEAR'; frame++) engine.update();
    expect(engine.state, `stopped with ${engine.maze.remainingDots} dots left`).toBe('LEVEL_CLEAR');
    expect(engine.score).toBeGreaterThanOrEqual(2600);
    }, 30000,
  );

  it('returns control to the player on manual input or when debug closes', () => {
    const engine = new GameEngine();
    engine.toggleDebug();
    engine.setAutoPlayLevel('expert');
    engine.start();
    engine.requestDirection('up');
    expect(engine.autoPlayLevel).toBeNull();
    expect(engine.player.requestedDirection).toBe('up');
    engine.setAutoPlayLevel('tas');
    engine.toggleDebug();
    expect(engine.autoPlayLevel).toBeNull();
    engine.setAutoPlayLevel('tas');
    expect(engine.autoPlayLevel).toBeNull();
  });
});
