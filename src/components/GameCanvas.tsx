import { useEffect, useRef, useState } from 'react';
import type { SoundEngine } from '../audio/SoundEngine';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../config/constants';
import type { GameEngine } from '../engine/GameEngine';
import type { GameMode } from '../engine/GameModes';
import { GameLoop, type GameSpeed } from '../engine/GameLoop';
import { attachKeyboard } from '../input/KeyboardController';
import { attachSwipe } from '../input/SwipeController';
import { Renderer } from '../rendering/Renderer';
import { saveHighScore } from '../storage/highScore';

type Snapshot = ReturnType<GameEngine['snapshot']>;

export function GameCanvas({ engine, sound, speed, onSnapshot, onStart, onMenuModeChange }: {
  engine: GameEngine; sound: SoundEngine; speed: GameSpeed; onSnapshot: (snapshot: Snapshot) => void;
  onStart: () => void; onMenuModeChange: (mode: GameMode) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<GameLoop | null>(null);
  const startRef = useRef(onStart);
  const menuModeRef = useRef(onMenuModeChange);
  startRef.current = onStart;
  menuModeRef.current = onMenuModeChange;
  const [display, setDisplay] = useState({ scale: 1, pixelRatio: 1 });
  const [error, setError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !viewport || !context) { setError(true); return; }
    const renderer = new Renderer(context);
    const playSound = (cue: Parameters<SoundEngine['play']>[0]) => sound.play(cue);
    engine.onSound = playSound;
    let lastSnapshotAt = -Infinity;
    let persistedScore = engine.highScore;
    const loop = new GameLoop(() => engine.update(), () => {
      renderer.draw(engine);
      if (engine.highScore !== persistedScore) {
        saveHighScore(engine.highScore);
        persistedScore = engine.highScore;
      }
      const now = performance.now();
      if (now - lastSnapshotAt >= 50) {
        onSnapshot(engine.snapshot());
        lastSnapshotAt = now;
      }
    });
    loopRef.current = loop;
    const detach = attachKeyboard(engine, window, {
      onStart: () => startRef.current(),
      onMenuModeChange: (mode) => menuModeRef.current(mode),
    });
    const detachSwipe = attachSwipe(viewport, (direction) => {
      engine.requestDirection(direction);
      onSnapshot(engine.snapshot());
    });
    const visibilityChange = () => {
      if (document.hidden) { engine.pause(); loop.stop(); onSnapshot(engine.snapshot()); }
      else loop.start();
    };
    document.addEventListener('visibilitychange', visibilityChange);
    loop.start();
    return () => {
      loop.stop(); detach();
      loopRef.current = null;
      detachSwipe();
      document.removeEventListener('visibilitychange', visibilityChange);
      if (engine.onSound === playSound) engine.onSound = null;
    };
  }, [engine, sound, onSnapshot]);

  useEffect(() => { loopRef.current?.setSpeed(speed); }, [speed]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resize = () => {
      const fit = Math.min(viewport.clientWidth / SCREEN_WIDTH, viewport.clientHeight / SCREEN_HEIGHT);
      // Fill compact viewports; use exact pixel multiples when at least 2× fits.
      if (fit > 0) {
        const scale = fit >= 2 ? Math.floor(fit) : fit;
        const pixelRatio = window.devicePixelRatio || 1;
        setDisplay(current => current.scale === scale && current.pixelRatio === pixelRatio
          ? current : { scale, pixelRatio });
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    window.addEventListener('resize', resize);
    resize();
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, []);

  return <div className="canvas-viewport" ref={viewportRef}>
    {error ? <p role="alert">Canvas 2Dを利用できません。対応ブラウザーで開いてください。</p> :
      <canvas ref={canvasRef}
        width={Math.round(SCREEN_WIDTH * display.scale * display.pixelRatio)}
        height={Math.round(SCREEN_HEIGHT * display.scale * display.pixelRatio)}
        style={{ width: SCREEN_WIDTH * display.scale, height: SCREEN_HEIGHT * display.scale }}
        aria-label="PAC-SANの迷路。Enterで開始し、画面のスワイプ、矢印キーまたはWASDで移動します。"
        role="img" />}
  </div>;
}
