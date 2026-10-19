import { describe, expect, it } from 'vitest';
import {
  EVOLUTION_GENE_RANGES,
  chooseEvolutionDirection,
  type EvolutionGene,
  type EvolutionGenome,
} from '../ai/AutoPlayer';
import {
  EVOLUTION_FITNESS_VERSION,
  EVOLUTION_REWARDS,
  EvolutionTrainer,
  calculateEvolutionFitness,
} from '../ai/EvolutionTrainer';
import { TILE_CENTER, TILE_SIZE } from '../config/constants';
import { PacSan } from '../entities/PacSan';
import { createGhosts } from '../entities/Ghost';
import { Maze, tileIndex } from '../map/maze';

const at = (tile: number) => tile * TILE_SIZE + TILE_CENTER;

const cautiousGenome: EvolutionGenome = {
  foodDistanceWeight: 1,
  dangerRadius: 5,
  dangerWeight: 9,
  projectionTiles: 4,
  clusterBonus: 0,
  powerDotBias: 0,
  fruitBias: 0,
  reversePenalty: 0,
  revisitPenalty: 0,
};

describe('genetic training', () => {
  it('strongly rewards survival and clearing a round', () => {
    const alive = calculateEvolutionFitness({
      gameScore: 1_000,
      collectedDots: 100,
      clearedRounds: 0,
      remainingLives: 3,
      deaths: 0,
      gameOver: false,
      stalled: false,
    });
    const afterDeath = calculateEvolutionFitness({
      gameScore: 1_000,
      collectedDots: 100,
      clearedRounds: 0,
      remainingLives: 2,
      deaths: 1,
      gameOver: false,
      stalled: false,
    });
    const clearedRound = calculateEvolutionFitness({
      gameScore: 1_000,
      collectedDots: 100,
      clearedRounds: 1,
      remainingLives: 3,
      deaths: 0,
      gameOver: false,
      stalled: false,
    });

    expect(alive - afterDeath).toBe(
      EVOLUTION_REWARDS.remainingLife + EVOLUTION_REWARDS.deathPenalty);
    expect(clearedRound - alive).toBe(EVOLUTION_REWARDS.roundClear);
  });

  it('applies an extra penalty when a run reaches game over', () => {
    const gameOver = calculateEvolutionFitness({
      gameScore: 5_000,
      collectedDots: 150,
      clearedRounds: 0,
      remainingLives: 0,
      deaths: 3,
      gameOver: true,
      stalled: false,
    });
    const active = calculateEvolutionFitness({
      gameScore: 5_000,
      collectedDots: 150,
      clearedRounds: 0,
      remainingLives: 1,
      deaths: 2,
      gameOver: false,
      stalled: false,
    });

    expect(active).toBeGreaterThan(gameOver);
  });

  it('queues reward changes until the next generation', () => {
    const trainer = new EvolutionTrainer({
      populationSize: 4, maxFramesPerEpisode: 1, seeds: [5],
    });
    const changedRewards = { ...EVOLUTION_REWARDS, roundClear: 25_000 };

    expect(trainer.queueRewards(changedRewards)).toBe(true);
    expect(trainer.snapshot().rewards.roundClear).toBe(EVOLUTION_REWARDS.roundClear);
    expect(trainer.snapshot().pendingRewards).toEqual(changedRewards);

    trainer.step();
    expect(trainer.generation).toBe(2);
    expect(trainer.snapshot().rewards).toEqual(changedRewards);
    expect(trainer.snapshot().pendingRewards).toBeNull();
    expect(trainer.history).toEqual([]);
    expect(trainer.bestEverGenome).toBeNull();
  });

  it('injects an imported genome into the next generation and checkpoints the queue', () => {
    const trainer = new EvolutionTrainer({
      populationSize: 4, maxFramesPerEpisode: 1, seeds: [6],
    });

    expect(trainer.queueGenome(cautiousGenome)).toBe(true);
    expect(trainer.snapshot().pendingGenome).toBe(true);
    expect(trainer.createCheckpoint().pendingGenome).toEqual(cautiousGenome);

    trainer.step();
    expect(trainer.generation).toBe(2);
    expect(trainer.population[0].genome).toEqual(cautiousGenome);
    expect(trainer.snapshot().pendingGenome).toBe(false);
    expect(trainer.queueGenome({ dangerRadius: 99 })).toBe(false);
  });

  it('changes the population size at the generation boundary without resetting learning', () => {
    const trainer = new EvolutionTrainer({
      populationSize: 8, maxFramesPerEpisode: 2, seeds: [8],
    });

    expect(trainer.queuePopulationSize(12)).toBe(true);
    expect(trainer.population).toHaveLength(8);
    expect(trainer.snapshot().pendingPopulationSize).toBe(12);
    expect(trainer.createCheckpoint().pendingPopulationSize).toBe(12);

    trainer.step();
    expect(trainer.population).toHaveLength(8);
    trainer.step();

    expect(trainer.generation).toBe(2);
    expect(trainer.population).toHaveLength(12);
    expect(trainer.history).toHaveLength(1);
    expect(trainer.bestEverGenome).not.toBeNull();
    expect(trainer.snapshot().pendingPopulationSize).toBeNull();
    expect(trainer.queuePopulationSize(3)).toBe(false);
  });

  it('restores a queued population-size change from a checkpoint', () => {
    const trainer = new EvolutionTrainer({ populationSize: 8 });
    trainer.queuePopulationSize(24);
    const resumed = new EvolutionTrainer({ populationSize: 12 });

    expect(resumed.restoreCheckpoint(trainer.createCheckpoint())).toBe(false);
    expect(resumed.population).toHaveLength(8);
    expect(resumed.queuedPopulationSize).toBe(24);
    expect(resumed.snapshot().pendingPopulationSize).toBe(24);
  });

  it('lets evolved danger genes change the selected route', () => {
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

    const recklessGenome: EvolutionGenome = {
      ...cautiousGenome, dangerRadius: 1, dangerWeight: 0.5, projectionTiles: 0,
    };
    expect(chooseEvolutionDirection(player, [ghost], maze, recklessGenome)?.direction).toBe('left');
    expect(chooseEvolutionDirection(player, [ghost], maze, cautiousGenome)?.direction).toBe('right');
  });

  it('evaluates the whole population and advances generations', () => {
    const trainer = new EvolutionTrainer({
      populationSize: 4,
      maxFramesPerEpisode: 2,
      stagnationFrames: 10,
      seeds: [123],
    });
    trainer.step();
    trainer.step();

    expect(trainer.generation).toBe(2);
    expect(trainer.history).toHaveLength(1);
    expect(trainer.population).toHaveLength(4);
    expect(trainer.bestEverGenome).not.toBeNull();
  });

  it('keeps crossover and mutation inside every gene range', () => {
    const trainer = new EvolutionTrainer({
      populationSize: 8,
      maxFramesPerEpisode: 1,
      stagnationFrames: 1,
      seeds: [1],
      mutationRate: 1,
    });
    for (let generation = 0; generation < 8; generation++) trainer.step();

    for (const candidate of trainer.population) {
      for (const gene of Object.keys(EVOLUTION_GENE_RANGES) as EvolutionGene[]) {
        const [minimum, maximum] = EVOLUTION_GENE_RANGES[gene];
        expect(candidate.genome[gene]).toBeGreaterThanOrEqual(minimum);
        expect(candidate.genome[gene]).toBeLessThanOrEqual(maximum);
      }
    }
  });

  it('restores the population, history, champion, and genetic RNG from a checkpoint', () => {
    const options = {
      populationSize: 4, maxFramesPerEpisode: 1, stagnationFrames: 1,
      seeds: [7], mutationRate: 1,
    } as const;
    const original = new EvolutionTrainer(options);
    original.step();
    const checkpoint = original.createCheckpoint();
    const resumed = new EvolutionTrainer(options);
    resumed.restoreCheckpoint(checkpoint);

    expect(resumed.generation).toBe(original.generation);
    expect(resumed.history).toEqual(original.history);
    expect(resumed.bestEverGenome).toEqual(original.bestEverGenome);
    expect(resumed.population.map((candidate) => candidate.genome))
      .toEqual(original.population.map((candidate) => candidate.genome));

    original.step();
    resumed.step();
    expect(resumed.population.map((candidate) => candidate.genome))
      .toEqual(original.population.map((candidate) => candidate.genome));
  });

  it('keeps legacy genomes but resets scores from an older reward version', () => {
    const trainer = new EvolutionTrainer({
      populationSize: 4, maxFramesPerEpisode: 1, seeds: [9],
    });
    trainer.step();
    const current = trainer.createCheckpoint();
    const legacy = { ...current, fitnessVersion: EVOLUTION_FITNESS_VERSION - 1 };
    const resumed = new EvolutionTrainer({ populationSize: 4 });

    expect(resumed.restoreCheckpoint(legacy)).toBe(true);
    expect(resumed.generation).toBe(current.generation);
    expect(resumed.population.map((candidate) => candidate.genome)).toEqual(current.population);
    expect(resumed.history).toEqual([]);
    expect(resumed.bestEverFitness).toBe(0);
    expect(resumed.bestEverGenome).toBeNull();
    expect(resumed.createCheckpoint().fitnessVersion).toBe(EVOLUTION_FITNESS_VERSION);
  });
});
