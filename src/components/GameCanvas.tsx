import { useEffect, useRef, useState } from 'react';
import type { SoundEngine } from '../audio/SoundEngine';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../config/constants';
import type { GameEngine } from '../engine/GameEngine';
import { GameLoop } from '../engine/GameLoop';
import { attachKeyboard } from '../input/KeyboardController';
import { Renderer } from '../rendering/Renderer';
import { saveHighScore } from '../storage/highScore';

type Snapshot = ReturnType<GameEngine['snapshot']>;

export function GameCanvas({ engine, sound, onSnapshot }: {
  engine: GameEngine; sound: SoundEngine; onSnapshot: (snapshot: Snapshot) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context) { setError(true); return; }
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
    const detach = attachKeyboard(engine, window);
    const visibilityChange = () => {
      if (document.hidden) { engine.pause(); loop.stop(); onSnapshot(engine.snapshot()); }
      else loop.start();
    };
    document.addEventListener('visibilitychange', visibilityChange);
    loop.start();
    return () => {
      loop.stop(); detach();
      document.removeEventListener('visibilitychange', visibilityChange);
      if (engine.onSound === playSound) engine.onSound = null;
    };
  }, [engine, sound, onSnapshot]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resize = () => {
      const fit = Math.min(viewport.clientWidth / SCREEN_WIDTH, viewport.clientHeight / SCREEN_HEIGHT);
      // Prefer integer scaling; shrink the complete screen when even 1× cannot fit.
      if (fit > 0) setScale(fit >= 1 ? Math.floor(fit) : fit);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    resize();
    return () => observer.disconnect();
  }, []);

  return <div className="canvas-viewport" ref={viewportRef}>
    {error ? <p role="alert">Canvas 2Dを利用できません。対応ブラウザーで開いてください。</p> :
      <canvas ref={canvasRef} width={SCREEN_WIDTH} height={SCREEN_HEIGHT}
        style={{ width: SCREEN_WIDTH * scale, height: SCREEN_HEIGHT * scale }}
        aria-label="PAC-SANの迷路。Enterで開始し、矢印キーまたはWASDで移動します。"
        role="img" />}
  </div>;
}
