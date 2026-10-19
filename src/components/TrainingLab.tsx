import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  EVOLUTION_FITNESS_VERSION,
  EVOLUTION_REWARDS,
  EVOLUTION_REWARD_RANGES,
  EvolutionTrainer,
  type EvolutionCheckpoint,
  type EvolutionRewardConfig,
  type EvolutionRewardKey,
  type EvolutionTrainerSnapshot,
} from '../ai/EvolutionTrainer';
import type { EvolutionGene, EvolutionGenome } from '../ai/AutoPlayer';
import { SCREEN_HEIGHT, SCREEN_WIDTH, TOTAL_DOTS } from '../config/constants';
import { GameEngine } from '../engine/GameEngine';
import { Renderer } from '../rendering/Renderer';

const TRAINING_SPEEDS = [0.5, 1, 2, 4, 16, 64, 'max'] as const;
type TrainingSpeed = typeof TRAINING_SPEEDS[number];
const CHECKPOINT_KEY = 'pac-san.evolution-checkpoint.v1';
const BEST_GENOME_KEY = 'pac-san.best-evolution-genome.v1';

const REWARD_FIELDS: readonly {
  key: EvolutionRewardKey;
  label: string;
  description: string;
}[] = [
  { key: 'dotProgress', label: 'ドット進行', description: '取得ドット1個ごとの加点' },
  { key: 'roundClear', label: 'ラウンド突破', description: '1面クリアごとの加点' },
  { key: 'activeRun', label: '生存', description: '評価終了時に生存していた加点' },
  { key: 'remainingLife', label: '残機', description: '残機1つごとの加点' },
  { key: 'deathPenalty', label: 'ミス', description: '1ミスごとの減点' },
  { key: 'gameOverPenalty', label: 'ゲームオーバー', description: 'ゲームオーバー時の追加減点' },
  { key: 'stagnationPenalty', label: '停滞', description: '進行停滞で終了した場合の減点' },
];

const rewardSignature = (rewards: EvolutionRewardConfig) =>
  REWARD_FIELDS.map(({ key }) => rewards[key]).join(':');

const GENE_LABELS: Record<EvolutionGene, string> = {
  foodDistanceWeight: 'エサ距離',
  dangerRadius: '危険半径',
  dangerWeight: '危険回避',
  projectionTiles: '先読み',
  clusterBonus: '密集ボーナス',
  powerDotBias: 'パワーエサ',
  fruitBias: 'フルーツ',
  reversePenalty: '反転抑制',
  revisitPenalty: '再訪抑制',
};

const formatFitness = (value: number) => Math.round(value).toLocaleString('ja-JP');

interface ChampionRecord {
  readonly fitnessVersion: number;
  readonly rewards: EvolutionRewardConfig;
  readonly fitness: number;
  readonly generation: number;
  readonly genome: EvolutionGenome;
}

function loadSavedChampion(): ChampionRecord | null {
  try {
    const stored = localStorage.getItem(BEST_GENOME_KEY);
    if (!stored) return null;
    const value = JSON.parse(stored) as Partial<ChampionRecord>;
    const rewards = value.rewards ?? EVOLUTION_REWARDS;
    if (value.fitnessVersion !== EVOLUTION_FITNESS_VERSION
      || !Number.isFinite(value.fitness) || !Number.isFinite(value.generation)
      || REWARD_FIELDS.some(({ key }) => !Number.isFinite(rewards[key]))
      || !value.genome || (Object.keys(GENE_LABELS) as EvolutionGene[])
        .some((gene) => !Number.isFinite(value.genome?.[gene]))) return null;
    return { ...value, rewards: { ...rewards } } as ChampionRecord;
  } catch { return null; }
}

function loadTrainingCheckpoint(): EvolutionCheckpoint | null {
  try {
    const stored = localStorage.getItem(CHECKPOINT_KEY);
    return stored ? JSON.parse(stored) as EvolutionCheckpoint : null;
  } catch { return null; }
}

function saveTrainingCheckpoint(trainer: EvolutionTrainer): EvolutionCheckpoint | null {
  try {
    const checkpoint = trainer.createCheckpoint();
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
    return checkpoint;
  } catch { return null; }
}

function FitnessChart({ history }: { history: EvolutionTrainerSnapshot['history'] }) {
  if (history.length === 0) return <div className="fitness-chart-empty">最初の世代を評価中です</div>;
  const width = 300;
  const height = 78;
  const maximum = Math.max(1, ...history.map((entry) => entry.bestFitness));
  const points = (key: 'bestFitness' | 'averageFitness') => history.map((entry, index) => {
    const x = history.length === 1 ? width / 2 : index / (history.length - 1) * width;
    const y = height - entry[key] / maximum * (height - 10) - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return <div className="fitness-chart" aria-label="世代ごとの適応度推移">
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
      <line x1="0" y1={height - 1} x2={width} y2={height - 1} />
      <polyline className="average-line" points={points('averageFitness')} />
      <polyline className="best-line" points={points('bestFitness')} />
    </svg>
    <div><span className="best-key">最高</span><span className="average-key">平均</span></div>
  </div>;
}

function saveGenome(genome: EvolutionGenome, fitness: number, generation: number,
  rewards: EvolutionRewardConfig) {
  const data = JSON.stringify({
    version: 2,
    fitnessVersion: EVOLUTION_FITNESS_VERSION,
    rewards,
    fitness,
    generation,
    genome,
  }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `pac-san-genome-gen-${generation}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function RewardSettings({ initialRewards, snapshot, paused, speed, onApply, onClose }: {
  initialRewards: EvolutionRewardConfig;
  snapshot: EvolutionTrainerSnapshot;
  paused: boolean;
  speed: TrainingSpeed;
  onApply: (rewards: EvolutionRewardConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EvolutionRewardConfig>({ ...initialRewards });
  return <div className="reward-settings-layer">
    <button type="button" className="reward-settings-backdrop" aria-label="報酬設定を閉じる"
      onClick={onClose} />
    <section className="reward-settings-dialog" role="dialog" aria-modal="true"
      aria-labelledby="reward-settings-title">
      <header>
        <div><span>FITNESS PARAMETERS</span><h2 id="reward-settings-title">報酬パラメータ</h2></div>
        <button type="button" onClick={onClose} aria-label="閉じる">×</button>
      </header>
      <div className={`reward-training-status${paused ? ' paused' : ''}`}>
        <i /><div><span>BACKGROUND TRAINING</span>
          <strong>GEN {String(snapshot.generation).padStart(3, '0')} · {paused
            ? '一時停止' : speed === 'max' ? 'MAX' : `${speed}×`}</strong></div>
        <small>{snapshot.completed}/{snapshot.populationSize}</small>
      </div>
      <p className="reward-settings-intro">
        現在の世代は今の条件で最後まで評価し、変更は次世代から全個体へ適用します。
      </p>
      <div className="reward-fields">
        {REWARD_FIELDS.map(({ key, label, description }) => {
          const [minimum, maximum, step] = EVOLUTION_REWARD_RANGES[key];
          return <label key={key}>
            <span><strong>{label}</strong><small>{description}</small></span>
            <input type="number" min={minimum} max={maximum} step={step} value={draft[key]}
              onChange={(event) => setDraft({ ...draft,
                [key]: Math.max(minimum, Math.min(maximum, Number(event.target.value) || 0)),
              })} />
          </label>;
        })}
      </div>
      <footer>
        <button type="button" onClick={() => setDraft({ ...EVOLUTION_REWARDS })}>初期値に戻す</button>
        <button type="button" className="reward-apply" onClick={() => onApply(draft)}>
          次世代から適用
        </button>
      </footer>
      <p className="reward-settings-warning">適用時に適応度グラフとBEST記録を新しい基準で開始します。遺伝子群は維持されます。</p>
    </section>
  </div>;
}

const REPLAY_SPEEDS = [0.5, 1, 2, 4, 16] as const;
type ReplaySpeed = typeof REPLAY_SPEEDS[number];

function ChampionReplay({ champion, trainingStatus, onBack, onClose }: {
  champion: ChampionRecord;
  trainingStatus: {
    readonly generation: number;
    readonly completed: number;
    readonly populationSize: number;
    readonly paused: boolean;
    readonly speed: TrainingSpeed;
  };
  onBack: () => void;
  onClose: () => void;
}) {
  const createEngine = () => {
    // Keep this seed outside the two training seeds so the replay is also a small validation run.
    const engine = new GameEngine(0, 0x00c0ffee);
    engine.setEvolutionGenome(champion.genome);
    engine.start();
    return engine;
  };
  const [engine, setEngine] = useState(createEngine);
  const [snapshot, setSnapshot] = useState(() => engine.snapshot());
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [paused, setPaused] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState({ scale: 1, pixelRatio: 1 });
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);
  speedRef.current = speed;
  pausedRef.current = paused;

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return;
    const resize = () => {
      const availableWidth = Math.max(1, screen.clientWidth - 16);
      const availableHeight = Math.max(1, screen.clientHeight - 16);
      const fit = Math.min(availableWidth / SCREEN_WIDTH, availableHeight / SCREEN_HEIGHT);
      const scale = fit >= 1 ? Math.max(1, Math.floor(fit)) : fit;
      const pixelRatio = window.devicePixelRatio || 1;
      setDisplay((current) => current.scale === scale && current.pixelRatio === pixelRatio
        ? current : { scale, pixelRatio });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(screen);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const renderer = new Renderer(context);
    let animationId = 0;
    let previousTime: number | null = null;
    let accumulator = 0;
    let lastSnapshotAt = -Infinity;
    const tick = (time: number) => {
      const elapsed = previousTime === null ? 0 : Math.min(250, Math.max(0, time - previousTime));
      previousTime = time;
      if (!pausedRef.current) {
        accumulator += elapsed * speedRef.current * 60 / 1000;
        const steps = Math.min(1000, Math.floor(accumulator));
        accumulator -= steps;
        for (let index = 0; index < steps; index++) engine.update();
      } else accumulator = 0;
      renderer.draw(engine);
      if (time - lastSnapshotAt >= 100) {
        setSnapshot(engine.snapshot());
        lastSnapshotAt = time;
        if (engine.state === 'GAME_OVER' && !pausedRef.current) {
          pausedRef.current = true;
          setPaused(true);
        }
      }
      animationId = requestAnimationFrame(tick);
    };
    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [engine, display.scale, display.pixelRatio]);

  const restart = () => {
    const next = createEngine();
    pausedRef.current = false;
    setPaused(false);
    setEngine(next);
    setSnapshot(next.snapshot());
  };
  const stateLabel = {
    TITLE: '開始待ち', READY: '準備中', PLAYING: '観察中', PAUSED: '一時停止',
    PLAYER_DYING: 'ミス', LEVEL_CLEAR: 'ラウンドクリア', GAME_OVER: '検証終了',
  }[snapshot.state];
  const displayedState = snapshot.state === 'GAME_OVER' ? stateLabel
    : paused ? '一時停止' : stateLabel;

  return <main className="champion-replay">
    <section className="champion-stage">
      <div className="champion-stage-heading">
        <div><span>EVOLVED CHAMPION</span><h1>BEST GENOME REPLAY</h1></div>
        <div><span>未学習シード</span><strong>{speed}×</strong></div>
      </div>
      <div className="champion-screen" ref={screenRef}>
        <canvas ref={canvasRef}
          width={Math.round(SCREEN_WIDTH * display.scale * display.pixelRatio)}
          height={Math.round(SCREEN_HEIGHT * display.scale * display.pixelRatio)}
          style={{ width: SCREEN_WIDTH * display.scale, height: SCREEN_HEIGHT * display.scale }}
          aria-label="最良遺伝子による単独プレイ画面" role="img" />
      </div>
      <div className="champion-screen-footer"><span>SEED 00C0FFEE</span>
        <span>{displayedState}</span><span>FIXED 60 HZ</span></div>
    </section>

    <aside className="champion-controls">
      <div className="training-heading">
        <div><span>CHAMPION INSPECTOR</span><h2>育てた遺伝子を観察</h2></div>
        <button type="button" onClick={onClose}>ゲームへ戻る</button>
      </div>
      <button type="button" className="champion-back" onClick={onBack}>← 学習画面へ戻る</button>
      <div className={`background-training${trainingStatus.paused ? ' paused' : ''}`}>
        <i /><div><span>BACKGROUND TRAINING</span>
          <strong>GEN {String(trainingStatus.generation).padStart(3, '0')} · {trainingStatus.paused
            ? '一時停止' : `${trainingStatus.speed === 'max' ? 'MAX' : `${trainingStatus.speed}×`}`}</strong></div>
        <small>{trainingStatus.completed}/{trainingStatus.populationSize}</small>
      </div>
      <div className="champion-kpis">
        <div><span>学習世代</span><strong>{champion.generation}</strong></div>
        <div><span>適応度</span><strong>{formatFitness(champion.fitness)}</strong></div>
        <div><span>ラウンド</span><strong>{snapshot.level}</strong></div>
        <div><span>スコア</span><strong>{snapshot.score.toLocaleString('ja-JP')}</strong></div>
        <div><span>取得</span><strong>{TOTAL_DOTS - snapshot.remainingDots}</strong></div>
        <div><span>残機</span><strong>{snapshot.lives}</strong></div>
      </div>

      <section className="training-section">
        <div className="training-section-title"><span>観察速度</span><small>初期値 1×</small></div>
        <div className="replay-speed-options">{REPLAY_SPEEDS.map((value) => <button
          type="button" key={value} className={speed === value ? 'selected' : ''}
          aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}×</button>)}</div>
        <div className="champion-actions">
          <button type="button" className="training-primary" onClick={() => setPaused(!paused)}>
            {paused ? '▶ 再開' : 'Ⅱ 一時停止'}
          </button>
          <button type="button" onClick={restart}>最初から再生</button>
        </div>
      </section>

      <section className="training-section genome-section champion-genome">
        <div className="training-section-title"><span>採用遺伝子</span><small>BEST</small></div>
        <dl>{(Object.keys(GENE_LABELS) as EvolutionGene[]).map((gene) => <div key={gene}>
          <dt>{GENE_LABELS[gene]}</dt><dd>{champion.genome[gene].toFixed(2)}</dd>
        </div>)}</dl>
        <button type="button" className="save-genome"
          onClick={() => saveGenome(champion.genome, champion.fitness,
            champion.generation, champion.rewards)}>
          この遺伝子をJSON保存
        </button>
      </section>
      <p className="champion-note">学習とは別の乱数シードで再生しています。ここで安定して進める個体ほど、学習条件だけへの過適合が少ない候補です。</p>
    </aside>
  </main>;
}

export function TrainingLab({ onClose }: { onClose: () => void }) {
  const [trainingSession] = useState(() => {
    const trainer = new EvolutionTrainer({ populationSize: 12 });
    const checkpoint = loadTrainingCheckpoint();
    if (checkpoint) {
      try {
        const rewardMigrated = trainer.restoreCheckpoint(checkpoint);
        const restoredCheckpoint = rewardMigrated
          ? saveTrainingCheckpoint(trainer) ?? trainer.createCheckpoint() : checkpoint;
        return { trainer, resumed: true, checkpoint: restoredCheckpoint, rewardMigrated };
      } catch {
        try { localStorage.removeItem(CHECKPOINT_KEY); }
        catch { /* Fall back to a new training session. */ }
      }
    }
    return { trainer, resumed: false, checkpoint: null, rewardMigrated: false };
  });
  const trainer = trainingSession.trainer;
  const [snapshot, setSnapshot] = useState(() => trainer.snapshot());
  const [speed, setSpeed] = useState<TrainingSpeed>(4);
  const [paused, setPaused] = useState(false);
  const [populationSize, setPopulationSize] = useState(trainer.population.length);
  const [runUntilGeneration, setRunUntilGeneration] = useState<number | null>(null);
  const [savedChampion, setSavedChampion] = useState(loadSavedChampion);
  const [championView, setChampionView] = useState(false);
  const [replayChampion, setReplayChampion] = useState<ChampionRecord | null>(null);
  const [rewardSettingsOpen, setRewardSettingsOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [checkpointInfo, setCheckpointInfo] = useState<EvolutionCheckpoint | null>(
    trainingSession.checkpoint);
  const genomeFileRef = useRef<HTMLInputElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderersRef = useRef<(Renderer | null)[]>([]);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const runUntilRef = useRef(runUntilGeneration);
  const drawRef = useRef<() => void>(() => undefined);
  pausedRef.current = paused;
  speedRef.current = speed;
  runUntilRef.current = runUntilGeneration;

  useEffect(() => {
    if (championView) {
      renderersRef.current = [];
      return;
    }
    renderersRef.current = canvasRefs.current.slice(0, snapshot.populationSize).map((canvas) => {
      const context = canvas?.getContext('2d');
      return context ? new Renderer(context) : null;
    });
    drawRef.current();
  }, [snapshot.populationSize, championView]);

  useEffect(() => {
    let animationId = 0;
    let previousTime: number | null = null;
    let accumulator = 0;
    let lastUiUpdate = -Infinity;
    let lastDraw = -Infinity;
    let observedGeneration = trainer.generation;

    const draw = () => {
      for (let index = 0; index < trainer.population.length; index++) {
        renderersRef.current[index]?.draw(trainer.population[index].engine);
      }
    };
    drawRef.current = draw;

    const tick = (time: number) => {
      const elapsed = previousTime === null ? 0 : Math.min(250, Math.max(0, time - previousTime));
      previousTime = time;
      const targetGeneration = runUntilRef.current;
      const advancing = !pausedRef.current || targetGeneration !== null;

      if (advancing) {
        if (targetGeneration !== null || speedRef.current === 'max') {
          const deadline = performance.now() + 12;
          do trainer.step();
          while (performance.now() < deadline
            && (targetGeneration === null || trainer.generation < targetGeneration));
          if (targetGeneration !== null && trainer.generation >= targetGeneration) {
            runUntilRef.current = null;
            pausedRef.current = true;
            setRunUntilGeneration(null);
            setPaused(true);
          }
        } else {
          accumulator += elapsed * speedRef.current * 60 / 1000;
          const steps = Math.min(1000, Math.floor(accumulator));
          accumulator -= steps;
          for (let index = 0; index < steps; index++) trainer.step();
        }
      } else accumulator = 0;

      const generationChanged = observedGeneration !== trainer.generation;
      if (generationChanged) observedGeneration = trainer.generation;
      const renderInterval = speedRef.current === 'max' ? Number.POSITIVE_INFINITY
        : speedRef.current <= 4 ? 0 : 120;
      if ((advancing || time - lastDraw > 250) && time - lastDraw >= renderInterval) {
        draw();
        lastDraw = time;
      }
      if (generationChanged || time - lastUiUpdate >= 100) {
        setSnapshot(trainer.snapshot());
        lastUiUpdate = time;
      }
      animationId = requestAnimationFrame(tick);
    };
    animationId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationId);
      drawRef.current = () => undefined;
    };
  }, [trainer]);

  useEffect(() => {
    if (!trainer.bestEverGenome) return;
    const next: ChampionRecord = {
      fitnessVersion: EVOLUTION_FITNESS_VERSION,
      rewards: trainer.rewardConfig,
      fitness: trainer.bestEverFitness,
      generation: trainer.generation - 1,
      genome: { ...trainer.bestEverGenome },
    };
    setSavedChampion((current) => {
      if (current && rewardSignature(current.rewards) === rewardSignature(next.rewards)
        && current.fitness >= next.fitness) return current;
      try {
        localStorage.setItem(BEST_GENOME_KEY, JSON.stringify(next));
      } catch { /* Training continues when storage is unavailable. */ }
      return next;
    });
  }, [snapshot.bestEverFitness, trainer]);

  useEffect(() => {
    setCheckpointInfo(saveTrainingCheckpoint(trainer));
  }, [snapshot.generation, trainer]);

  useEffect(() => {
    const persist = () => { saveTrainingCheckpoint(trainer); };
    window.addEventListener('pagehide', persist);
    return () => {
      persist();
      window.removeEventListener('pagehide', persist);
    };
  }, [trainer]);

  const reset = () => {
    trainer.reset(populationSize);
    runUntilRef.current = null;
    pausedRef.current = true;
    setRunUntilGeneration(null);
    setPaused(true);
    setSnapshot(trainer.snapshot());
    setCheckpointInfo(saveTrainingCheckpoint(trainer));
    requestAnimationFrame(() => drawRef.current());
  };
  const stepOnce = () => {
    trainer.step();
    setSnapshot(trainer.snapshot());
    requestAnimationFrame(() => drawRef.current());
  };
  const runOneGeneration = () => {
    const target = trainer.generation + 1;
    runUntilRef.current = target;
    pausedRef.current = true;
    setPaused(true);
    setRunUntilGeneration(target);
  };

  const applyRewards = (rewards: EvolutionRewardConfig) => {
    if (!trainer.queueRewards(rewards)) return;
    setSnapshot(trainer.snapshot());
    setCheckpointInfo(saveTrainingCheckpoint(trainer));
    setRewardSettingsOpen(false);
  };

  const importGenome = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error('ファイルが大きすぎます。');
      const parsed = JSON.parse(await file.text()) as unknown;
      const genome = parsed && typeof parsed === 'object' && 'genome' in parsed
        ? (parsed as { genome?: unknown }).genome : parsed;
      if (!trainer.queueGenome(genome)) throw new Error('対応していない遺伝子形式です。');
      setImportError(null);
      setSnapshot(trainer.snapshot());
      setCheckpointInfo(saveTrainingCheckpoint(trainer));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'JSONを読み込めませんでした。');
    }
  };

  const leaderIndex = snapshot.candidates.reduce((best, candidate, index, candidates) =>
    candidate.fitness > candidates[best].fitness ? index : best, 0);
  const leaderGenome = trainer.population[leaderIndex]?.genome;
  const headless = speed === 'max' || runUntilGeneration !== null;
  const liveChampion = trainer.bestEverGenome ? {
    fitnessVersion: EVOLUTION_FITNESS_VERSION,
    rewards: snapshot.rewards,
    fitness: trainer.bestEverFitness,
    generation: trainer.generation - 1,
    genome: trainer.bestEverGenome,
  } : null;
  const savedChampionForCurrentRewards = savedChampion
    && rewardSignature(savedChampion.rewards) === rewardSignature(snapshot.rewards)
    ? savedChampion : null;
  const champion = liveChampion && (!savedChampionForCurrentRewards
    || liveChampion.fitness >= savedChampionForCurrentRewards.fitness)
    ? liveChampion : savedChampionForCurrentRewards;

  if (championView && replayChampion) return <ChampionReplay champion={replayChampion}
    trainingStatus={{
      generation: snapshot.generation,
      completed: snapshot.completed,
      populationSize: snapshot.populationSize,
      paused,
      speed,
    }}
    onBack={() => setChampionView(false)} onClose={onClose} />;

  return <>
  <main className={`training-lab population-${snapshot.populationSize}${headless ? ' headless' : ''}`}>
    <section className="training-stage" aria-label="遺伝的アルゴリズムの個体群">
      <div className="training-stage-heading">
        <div>
          <span>LIVE POPULATION</span>
          <h1>GENERATION {String(snapshot.generation).padStart(3, '0')}</h1>
        </div>
        <div className="training-stage-status">
          <span>{snapshot.completed} / {snapshot.populationSize} 評価完了</span>
          <strong>{headless ? 'HEADLESS' : `${speed}×`}</strong>
        </div>
      </div>
      <div className="candidate-grid">
        {snapshot.candidates.map((candidate, index) => <article
          className={`candidate-card${index === leaderIndex ? ' leader' : ''}`}
          key={candidate.id}>
          <header><span>#{String(candidate.id).padStart(2, '0')}</span>
            <strong>{formatFitness(candidate.fitness)}</strong></header>
          <div className="candidate-screen">
            <canvas ref={(canvas) => { canvasRefs.current[index] = canvas; }}
              width="224" height="288"
              aria-label={`候補${candidate.id}のプレイ画面`} role="img" />
            {headless && <span>描画停止中</span>}
          </div>
          <div className="candidate-progress"><i style={{ width: `${candidate.progress * 100}%` }} /></div>
          <footer><span>S {candidate.score.toLocaleString('ja-JP')}</span>
            <span>D {candidate.dots}</span><span>R {candidate.episode}/{snapshot.episodeCount}</span></footer>
        </article>)}
      </div>
    </section>

    <aside className="training-controls">
      <div className="training-heading">
        <div><span>EVOLUTION CONSOLE</span><h2>AI TRAINING LAB</h2></div>
        <button type="button" onClick={onClose}>ゲームへ戻る</button>
      </div>

      <div className="training-kpis">
        <div><span>現在最高</span><strong>{formatFitness(snapshot.bestFitness)}</strong></div>
        <div><span>現在平均</span><strong>{formatFitness(snapshot.averageFitness)}</strong></div>
        <div><span>歴代最高</span><strong>{formatFitness(snapshot.bestEverFitness)}</strong></div>
      </div>

      <section className="training-section">
        <div className="training-section-title"><span>実行速度</span>
          <small>固定ステップ</small></div>
        <div className="speed-options">
          {TRAINING_SPEEDS.map((value) => <button type="button" key={value}
            className={speed === value ? 'selected' : ''}
            aria-pressed={speed === value}
            onClick={() => setSpeed(value)}>{value === 'max' ? 'MAX' : `${value}×`}</button>)}
        </div>
        <p className="training-note">MAXでは描画を止め、約12msずつ処理して操作への応答を維持します。</p>
      </section>

      <div className="training-actions">
        <button className="training-primary" type="button"
          onClick={() => setPaused(!paused)} disabled={runUntilGeneration !== null}>
          {paused ? '▶ 再開' : 'Ⅱ 一時停止'}
        </button>
        <button type="button" onClick={stepOnce} disabled={!paused || runUntilGeneration !== null}>1 STEP</button>
        <button type="button" onClick={runOneGeneration} disabled={runUntilGeneration !== null}>
          {runUntilGeneration ? '世代を計算中…' : '1 GENERATION'}
        </button>
      </div>

      <button type="button" className="watch-champion"
        disabled={!champion || runUntilGeneration !== null}
        onClick={() => {
          setReplayChampion(champion);
          setChampionView(true);
        }}>
        {champion ? 'BESTを1画面で観察' : '1世代完了後にBESTを観察'}
      </button>

      <section className="training-section">
        <div className="training-section-title"><span>適応度</span><small>世代推移</small></div>
        <FitnessChart history={snapshot.history} />
      </section>

      <section className="training-section genome-section">
        <div className="training-section-title"><span>現在の先頭個体</span>
          <small>#{String(snapshot.candidates[leaderIndex]?.id ?? 0).padStart(2, '0')}</small></div>
        {leaderGenome && <dl>{(Object.keys(GENE_LABELS) as EvolutionGene[]).map((gene) => <div key={gene}>
          <dt>{GENE_LABELS[gene]}</dt><dd>{leaderGenome[gene].toFixed(2)}</dd>
        </div>)}</dl>}
        <div className="genome-file-actions">
          <button type="button" className="save-genome"
            disabled={!champion}
            onClick={() => champion && saveGenome(champion.genome, champion.fitness,
              champion.generation, champion.rewards)}>
            BESTを保存
          </button>
          <button type="button" className="import-genome"
            onClick={() => genomeFileRef.current?.click()}>JSONを取込</button>
          <input ref={genomeFileRef} type="file" accept="application/json,.json"
            className="sr-only" onChange={importGenome} />
        </div>
        {snapshot.pendingGenome
          ? <p className="genome-import-status">✓ 次世代へインポート遺伝子を投入予定</p>
          : importError && <p className="genome-import-status error">! {importError}</p>}
      </section>

      <section className="training-section training-setup">
        <label>個体数<select value={populationSize}
          onChange={(event) => setPopulationSize(Number(event.target.value))}>
          {[8, 12, 16, 24].map((size) => <option key={size} value={size}>{size}体</option>)}
        </select></label>
        <button type="button" onClick={() => setCheckpointInfo(saveTrainingCheckpoint(trainer))}>
          現在地を保存
        </button>
        <button type="button" className="reward-settings-open"
          onClick={() => setRewardSettingsOpen(true)}>
          報酬パラメータ{snapshot.pendingRewards ? ' ●' : ''}
        </button>
        <button type="button" className="reset-training" onClick={reset}>学習を初期化</button>
        <p className="checkpoint-status">{checkpointInfo
          ? `✓ 世代 ${checkpointInfo.generation} を保存済み · 次回はこの個体群から自動再開${trainingSession.rewardMigrated && snapshot.history.length === 0 ? ' · 新報酬で再評価中' : ''}`
          : 'ブラウザー保存を利用できないため、このセッション内だけ学習します。'}</p>
        <p>再開時は保存した世代の先頭から再評価します。各個体は2つの共通シードで評価し、上位2体を保存します。</p>
      </section>
    </aside>
  </main>
  {rewardSettingsOpen && <RewardSettings
    initialRewards={snapshot.pendingRewards ?? snapshot.rewards}
    snapshot={snapshot}
    paused={paused}
    speed={speed}
    onApply={applyRewards}
    onClose={() => setRewardSettingsOpen(false)} />}
  </>;
}
