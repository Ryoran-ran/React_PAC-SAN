import { TOTAL_DOTS } from '../config/constants';
import { GameEngine } from '../engine/GameEngine';
import {
  EVOLUTION_GENE_RANGES,
  type EvolutionGene,
  type EvolutionGenome,
} from './AutoPlayer';

const GENES = Object.keys(EVOLUTION_GENE_RANGES) as EvolutionGene[];
const DISCRETE_GENES = new Set<EvolutionGene>(['dangerRadius', 'projectionTiles']);

export const EVOLUTION_FITNESS_VERSION = 2;

export interface EvolutionRewardConfig {
  readonly dotProgress: number;
  readonly roundClear: number;
  readonly activeRun: number;
  readonly remainingLife: number;
  readonly deathPenalty: number;
  readonly gameOverPenalty: number;
  readonly stagnationPenalty: number;
}

export type EvolutionRewardKey = keyof EvolutionRewardConfig;

export const EVOLUTION_REWARDS: EvolutionRewardConfig = {
  dotProgress: 12,
  roundClear: 12_000,
  activeRun: 1_000,
  remainingLife: 750,
  deathPenalty: 1_500,
  gameOverPenalty: 3_000,
  stagnationPenalty: 1_000,
};

export const EVOLUTION_REWARD_RANGES: Record<EvolutionRewardKey,
  readonly [minimum: number, maximum: number, step: number]> = {
  dotProgress: [0, 100, 1],
  roundClear: [0, 100_000, 500],
  activeRun: [0, 10_000, 100],
  remainingLife: [0, 10_000, 50],
  deathPenalty: [0, 10_000, 100],
  gameOverPenalty: [0, 30_000, 500],
  stagnationPenalty: [0, 10_000, 100],
};

export interface EvolutionFitnessInput {
  readonly gameScore: number;
  readonly collectedDots: number;
  readonly clearedRounds: number;
  readonly remainingLives: number;
  readonly deaths: number;
  readonly gameOver: boolean;
  readonly stalled: boolean;
}

export function calculateEvolutionFitness(input: EvolutionFitnessInput,
  rewards: EvolutionRewardConfig = EVOLUTION_REWARDS): number {
  const survivalReward = input.gameOver ? 0
    : rewards.activeRun + Math.max(0, input.remainingLives) * rewards.remainingLife;
  const penalties = input.deaths * rewards.deathPenalty
    + (input.gameOver ? rewards.gameOverPenalty : 0)
    + (input.stalled ? rewards.stagnationPenalty : 0);
  return Math.max(0,
    input.gameScore
    + input.collectedDots * rewards.dotProgress
    + input.clearedRounds * rewards.roundClear
    + survivalReward
    - penalties);
}

export interface EvolutionTrainerOptions {
  readonly populationSize?: number;
  readonly maxFramesPerEpisode?: number;
  readonly stagnationFrames?: number;
  readonly seeds?: readonly number[];
  readonly eliteCount?: number;
  readonly mutationRate?: number;
  readonly rewards?: EvolutionRewardConfig;
}

export interface GenerationResult {
  readonly generation: number;
  readonly bestFitness: number;
  readonly averageFitness: number;
}

export interface EvolutionCheckpoint {
  readonly version: 1;
  /** Missing on checkpoints created before survival-focused rewards. */
  readonly fitnessVersion?: number;
  readonly savedAt: string;
  readonly generation: number;
  readonly randomState: number;
  readonly population: readonly EvolutionGenome[];
  readonly history: readonly GenerationResult[];
  readonly bestEverFitness: number;
  readonly bestEverGenome: EvolutionGenome | null;
  readonly rewards?: EvolutionRewardConfig;
  readonly pendingRewards?: EvolutionRewardConfig | null;
  readonly pendingGenome?: EvolutionGenome | null;
}

export interface EvolutionCandidate {
  readonly id: number;
  readonly genome: EvolutionGenome;
  engine: GameEngine;
  fitness: number;
  completed: boolean;
  episode: number;
  frames: number;
  totalFrames: number;
  deaths: number;
  episodeDeaths: number;
  fitnessTotal: number;
  stagnantFrames: number;
  previousProgress: number;
  previousLives: number;
}

export interface EvolutionTrainerSnapshot {
  readonly generation: number;
  readonly completed: number;
  readonly populationSize: number;
  readonly episodeCount: number;
  readonly bestFitness: number;
  readonly averageFitness: number;
  readonly bestEverFitness: number;
  readonly rewards: EvolutionRewardConfig;
  readonly pendingRewards: EvolutionRewardConfig | null;
  readonly pendingGenome: boolean;
  readonly history: readonly GenerationResult[];
  readonly candidates: readonly {
    id: number;
    fitness: number;
    completed: boolean;
    episode: number;
    progress: number;
    score: number;
    dots: number;
    level: number;
    deaths: number;
  }[];
}

class EvolutionRandom {
  private state: number;

  constructor(seed = 0x2f6e2b1) { this.state = seed >>> 0; }

  get snapshot(): number { return this.state >>> 0; }

  next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }

  int(limit: number): number { return Math.floor(this.next() * limit); }
}

const DEFAULT_SEEDS = [0x5a17c3e1, 0x91e10da5] as const;

export class EvolutionTrainer {
  population: EvolutionCandidate[] = [];
  generation = 1;
  readonly history: GenerationResult[] = [];
  bestEverFitness = 0;
  bestEverGenome: EvolutionGenome | null = null;

  private populationSize: number;
  private readonly maxFramesPerEpisode: number;
  private readonly stagnationFrames: number;
  private readonly seeds: readonly number[];
  private readonly eliteCount: number;
  private readonly mutationRate: number;
  private rewards: EvolutionRewardConfig;
  private pendingRewards: EvolutionRewardConfig | null = null;
  private pendingGenome: EvolutionGenome | null = null;
  private random = new EvolutionRandom();

  constructor(options: EvolutionTrainerOptions = {}) {
    this.populationSize = Math.max(4, Math.round(options.populationSize ?? 12));
    this.maxFramesPerEpisode = Math.max(1, options.maxFramesPerEpisode ?? 6000);
    this.stagnationFrames = Math.max(1, options.stagnationFrames ?? 900);
    this.seeds = options.seeds?.length ? [...options.seeds] : DEFAULT_SEEDS;
    this.eliteCount = Math.max(1, Math.min(options.eliteCount ?? 2, this.populationSize));
    this.mutationRate = Math.max(0, Math.min(1, options.mutationRate ?? 0.24));
    this.rewards = { ...(options.rewards ?? EVOLUTION_REWARDS) };
    if (!this.isValidRewards(this.rewards)) throw new Error('Invalid evolution rewards.');
    this.reset();
  }

  get rewardConfig(): EvolutionRewardConfig { return { ...this.rewards }; }
  get queuedRewardConfig(): EvolutionRewardConfig | null {
    return this.pendingRewards ? { ...this.pendingRewards } : null;
  }
  get hasQueuedGenome(): boolean { return this.pendingGenome !== null; }

  queueRewards(rewards: EvolutionRewardConfig): boolean {
    if (!this.isValidRewards(rewards)) return false;
    this.pendingRewards = this.sameRewards(rewards, this.rewards) ? null : { ...rewards };
    return true;
  }

  queueGenome(genome: unknown): boolean {
    if (!this.isValidGenome(genome)) return false;
    this.pendingGenome = { ...genome };
    return true;
  }

  reset(populationSize = this.populationSize): void {
    this.populationSize = Math.max(4, Math.round(populationSize));
    this.generation = 1;
    this.history.length = 0;
    this.bestEverFitness = 0;
    this.bestEverGenome = null;
    this.pendingRewards = null;
    this.pendingGenome = null;
    this.random = new EvolutionRandom();
    this.population = Array.from({ length: this.populationSize }, (_, index) =>
      this.createCandidate(index + 1, this.randomGenome()));
  }

  createCheckpoint(): EvolutionCheckpoint {
    return {
      version: 1,
      fitnessVersion: EVOLUTION_FITNESS_VERSION,
      savedAt: new Date().toISOString(),
      generation: this.generation,
      randomState: this.random.snapshot,
      population: this.population.map((candidate) => ({ ...candidate.genome })),
      history: this.history.map((entry) => ({ ...entry })),
      bestEverFitness: this.bestEverFitness,
      bestEverGenome: this.bestEverGenome ? { ...this.bestEverGenome } : null,
      rewards: { ...this.rewards },
      pendingRewards: this.pendingRewards ? { ...this.pendingRewards } : null,
      pendingGenome: this.pendingGenome ? { ...this.pendingGenome } : null,
    };
  }

  /** Returns true when old fitness/history was discarded but its genomes were retained. */
  restoreCheckpoint(checkpoint: EvolutionCheckpoint): boolean {
    if (checkpoint.version !== 1 || !Number.isInteger(checkpoint.generation)
      || checkpoint.generation < 1 || !Number.isFinite(checkpoint.randomState)
      || !Array.isArray(checkpoint.population) || checkpoint.population.length < 4
      || !Array.isArray(checkpoint.history)
      || checkpoint.population.some((genome) => !this.isValidGenome(genome))
      || checkpoint.history.some((entry) => !Number.isInteger(entry.generation)
        || !Number.isFinite(entry.bestFitness) || !Number.isFinite(entry.averageFitness))
      || !Number.isFinite(checkpoint.bestEverFitness)
      || (checkpoint.fitnessVersion !== undefined
        && (!Number.isInteger(checkpoint.fitnessVersion) || checkpoint.fitnessVersion < 1))
      || (checkpoint.rewards !== undefined && !this.isValidRewards(checkpoint.rewards))
      || (checkpoint.pendingRewards !== undefined && checkpoint.pendingRewards !== null
        && !this.isValidRewards(checkpoint.pendingRewards))
      || (checkpoint.pendingGenome !== undefined && checkpoint.pendingGenome !== null
        && !this.isValidGenome(checkpoint.pendingGenome))
      || (checkpoint.bestEverGenome !== null
        && !this.isValidGenome(checkpoint.bestEverGenome))) {
      throw new Error('Invalid evolution checkpoint.');
    }
    const fitnessChanged = checkpoint.fitnessVersion !== EVOLUTION_FITNESS_VERSION;
    this.populationSize = checkpoint.population.length;
    this.generation = checkpoint.generation;
    this.history.splice(0, this.history.length,
      ...(fitnessChanged ? [] : checkpoint.history.map((entry) => ({ ...entry }))));
    this.bestEverFitness = fitnessChanged ? 0 : checkpoint.bestEverFitness;
    this.bestEverGenome = fitnessChanged ? null : checkpoint.bestEverGenome
      ? { ...checkpoint.bestEverGenome } : null;
    this.rewards = { ...(checkpoint.rewards ?? EVOLUTION_REWARDS) };
    this.pendingRewards = checkpoint.pendingRewards ? { ...checkpoint.pendingRewards } : null;
    this.pendingGenome = checkpoint.pendingGenome ? { ...checkpoint.pendingGenome } : null;
    this.random = new EvolutionRandom(checkpoint.randomState);
    this.population = checkpoint.population.map((genome, index) =>
      this.createCandidate(index + 1, { ...genome }));
    return fitnessChanged;
  }

  step(): void {
    for (const candidate of this.population) {
      if (!candidate.completed) this.updateCandidate(candidate);
    }
    if (this.population.every((candidate) => candidate.completed)) this.evolve();
  }

  snapshot(): EvolutionTrainerSnapshot {
    const estimates = this.population.map((candidate) => this.estimatedFitness(candidate));
    return {
      generation: this.generation,
      completed: this.population.filter((candidate) => candidate.completed).length,
      populationSize: this.population.length,
      episodeCount: this.seeds.length,
      bestFitness: Math.max(0, ...estimates),
      averageFitness: estimates.reduce((sum, value) => sum + value, 0) / estimates.length,
      bestEverFitness: this.bestEverFitness,
      rewards: { ...this.rewards },
      pendingRewards: this.pendingRewards ? { ...this.pendingRewards } : null,
      pendingGenome: this.pendingGenome !== null,
      history: [...this.history],
      candidates: this.population.map((candidate, index) => ({
        id: candidate.id,
        fitness: estimates[index],
        completed: candidate.completed,
        episode: candidate.episode + 1,
        progress: Math.min(1, candidate.frames / this.maxFramesPerEpisode),
        score: candidate.engine.score,
        dots: TOTAL_DOTS - candidate.engine.maze.remainingDots,
        level: candidate.engine.level,
        deaths: candidate.deaths,
      })),
    };
  }

  private updateCandidate(candidate: EvolutionCandidate): void {
    candidate.engine.update();
    candidate.frames++;
    candidate.totalFrames++;
    if (candidate.engine.lives < candidate.previousLives) {
      const deaths = candidate.previousLives - candidate.engine.lives;
      candidate.deaths += deaths;
      candidate.episodeDeaths += deaths;
    }
    candidate.previousLives = candidate.engine.lives;

    const progress = (candidate.engine.level - 1) * TOTAL_DOTS
      + TOTAL_DOTS - candidate.engine.maze.remainingDots;
    if (progress > candidate.previousProgress) {
      candidate.previousProgress = progress;
      candidate.stagnantFrames = 0;
    } else candidate.stagnantFrames++;

    if (candidate.engine.state === 'GAME_OVER'
      || candidate.frames >= this.maxFramesPerEpisode
      || candidate.stagnantFrames >= this.stagnationFrames) {
      this.completeEpisode(candidate);
    }
  }

  private completeEpisode(candidate: EvolutionCandidate): void {
    candidate.fitnessTotal += this.episodeFitness(candidate);
    if (candidate.episode + 1 < this.seeds.length) {
      candidate.episode++;
      candidate.frames = 0;
      candidate.episodeDeaths = 0;
      candidate.stagnantFrames = 0;
      candidate.previousProgress = 0;
      candidate.engine = this.createEngine(candidate.genome, this.seeds[candidate.episode]);
      candidate.previousLives = candidate.engine.lives;
      return;
    }
    candidate.fitness = candidate.fitnessTotal / this.seeds.length;
    candidate.completed = true;
  }

  private episodeFitness(candidate: EvolutionCandidate): number {
    const engine = candidate.engine;
    const collected = (engine.level - 1) * TOTAL_DOTS + TOTAL_DOTS - engine.maze.remainingDots;
    const clearedRounds = engine.level - 1;
    return calculateEvolutionFitness({
      gameScore: engine.score,
      collectedDots: collected,
      clearedRounds,
      remainingLives: engine.lives,
      deaths: candidate.episodeDeaths,
      gameOver: engine.state === 'GAME_OVER',
      stalled: candidate.stagnantFrames >= this.stagnationFrames,
    }, this.rewards);
  }

  private estimatedFitness(candidate: EvolutionCandidate): number {
    if (candidate.completed) return candidate.fitness;
    return (candidate.fitnessTotal + this.episodeFitness(candidate)) / this.seeds.length;
  }

  private evolve(): void {
    const ranked = [...this.population].sort((a, b) => b.fitness - a.fitness || a.id - b.id);
    const best = ranked[0];
    const average = ranked.reduce((sum, candidate) => sum + candidate.fitness, 0) / ranked.length;
    this.history.push({
      generation: this.generation,
      bestFitness: best.fitness,
      averageFitness: average,
    });
    if (!this.bestEverGenome || best.fitness > this.bestEverFitness) {
      this.bestEverFitness = best.fitness;
      this.bestEverGenome = { ...best.genome };
    }

    let genomes: EvolutionGenome[] = ranked.slice(0, this.eliteCount)
      .map((candidate) => ({ ...candidate.genome }));
    if (this.pendingGenome) {
      genomes = [{ ...this.pendingGenome }, ...genomes].slice(0, this.populationSize);
      this.pendingGenome = null;
    }
    while (genomes.length < this.populationSize) {
      const first = this.tournament(ranked).genome;
      const second = this.tournament(ranked).genome;
      genomes.push(this.mutate(this.crossover(first, second)));
    }
    this.generation++;
    if (this.pendingRewards) {
      this.rewards = { ...this.pendingRewards };
      this.pendingRewards = null;
      this.history.length = 0;
      this.bestEverFitness = 0;
      this.bestEverGenome = null;
    }
    this.population = genomes.map((genome, index) => this.createCandidate(index + 1, genome));
  }

  private tournament(ranked: readonly EvolutionCandidate[]): EvolutionCandidate {
    let winner = ranked[this.random.int(ranked.length)];
    for (let index = 1; index < 3; index++) {
      const challenger = ranked[this.random.int(ranked.length)];
      if (challenger.fitness > winner.fitness) winner = challenger;
    }
    return winner;
  }

  private randomGenome(): EvolutionGenome {
    const genome = {} as Record<EvolutionGene, number>;
    for (const gene of GENES) {
      const [minimum, maximum] = EVOLUTION_GENE_RANGES[gene];
      const value = minimum + this.random.next() * (maximum - minimum);
      genome[gene] = DISCRETE_GENES.has(gene) ? Math.round(value) : value;
    }
    return genome as unknown as EvolutionGenome;
  }

  private crossover(first: EvolutionGenome, second: EvolutionGenome): EvolutionGenome {
    const child = {} as Record<EvolutionGene, number>;
    for (const gene of GENES) {
      const blend = this.random.next();
      child[gene] = first[gene] * blend + second[gene] * (1 - blend);
      if (DISCRETE_GENES.has(gene)) child[gene] = Math.round(child[gene]);
    }
    return child as unknown as EvolutionGenome;
  }

  private mutate(genome: EvolutionGenome): EvolutionGenome {
    const mutated = { ...genome } as Record<EvolutionGene, number>;
    for (const gene of GENES) {
      if (this.random.next() >= this.mutationRate) continue;
      const [minimum, maximum] = EVOLUTION_GENE_RANGES[gene];
      const centeredNoise = this.random.next() + this.random.next() - 1;
      const value = mutated[gene] + centeredNoise * (maximum - minimum) * 0.22;
      mutated[gene] = Math.max(minimum, Math.min(maximum, value));
      if (DISCRETE_GENES.has(gene)) mutated[gene] = Math.round(mutated[gene]);
    }
    return mutated as unknown as EvolutionGenome;
  }

  private createCandidate(id: number, genome: EvolutionGenome): EvolutionCandidate {
    const engine = this.createEngine(genome, this.seeds[0]);
    return {
      id, genome, engine, fitness: 0, completed: false, episode: 0,
      frames: 0, totalFrames: 0, deaths: 0, episodeDeaths: 0,
      fitnessTotal: 0, stagnantFrames: 0, previousProgress: 0,
      previousLives: engine.lives,
    };
  }

  private createEngine(genome: EvolutionGenome, seed: number): GameEngine {
    const engine = new GameEngine(0, seed);
    engine.setEvolutionGenome(genome);
    engine.start();
    return engine;
  }

  private isValidGenome(genome: unknown): genome is EvolutionGenome {
    if (!genome || typeof genome !== 'object') return false;
    const candidate = genome as Partial<EvolutionGenome>;
    return GENES.every((gene) => {
      const value = candidate[gene];
      const [minimum, maximum] = EVOLUTION_GENE_RANGES[gene];
      return typeof value === 'number' && Number.isFinite(value)
        && value >= minimum && value <= maximum;
    });
  }

  private isValidRewards(rewards: unknown): rewards is EvolutionRewardConfig {
    if (!rewards || typeof rewards !== 'object') return false;
    const candidate = rewards as Partial<EvolutionRewardConfig>;
    return (Object.keys(EVOLUTION_REWARD_RANGES) as EvolutionRewardKey[]).every((key) => {
      const value = candidate[key];
      const [minimum, maximum] = EVOLUTION_REWARD_RANGES[key];
      return typeof value === 'number' && Number.isFinite(value)
        && value >= minimum && value <= maximum;
    });
  }

  private sameRewards(first: EvolutionRewardConfig, second: EvolutionRewardConfig): boolean {
    return (Object.keys(EVOLUTION_REWARD_RANGES) as EvolutionRewardKey[])
      .every((key) => first[key] === second[key]);
  }
}
