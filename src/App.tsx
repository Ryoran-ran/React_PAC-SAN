import { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { DebugPanel } from './components/DebugPanel';
import { DebugDisplayControls } from './components/DebugDisplayControls';
import { TOTAL_DOTS, type Direction } from './config/constants';
import { GameEngine } from './engine/GameEngine';
import type { DebugDisplayKey } from './engine/DebugDisplay';
import type { AutoPlayLevel } from './ai/AutoPlayer';
import { loadHighScore } from './storage/highScore';

const STATE_LABELS = { TITLE: '開始待ち', READY: '準備中', PLAYING: 'プレイ中', PAUSED: '一時停止', LEVEL_CLEAR: '迷路クリア' };

export default function App() {
  const [engine] = useState(() => new GameEngine(loadHighScore()));
  const [snapshot, setSnapshot] = useState(() => engine.snapshot());
  const canPause = ['READY', 'PLAYING', 'PAUSED'].includes(snapshot.state);
  const canStart = snapshot.state === 'TITLE' || snapshot.state === 'LEVEL_CLEAR';
  const move = (direction: Direction) => {
    engine.requestDirection(direction);
    setSnapshot(engine.snapshot());
  };
  const changeAutoPlay = (level: AutoPlayLevel | null) => {
    engine.setAutoPlayLevel(level);
    setSnapshot(engine.snapshot());
  };
  const toggleDebug = () => {
    engine.toggleDebug();
    setSnapshot(engine.snapshot());
  };
  const changeDebugDisplay = (key: DebugDisplayKey, visible: boolean) => {
    engine.setDebugDisplayOption(key, visible);
    setSnapshot(engine.snapshot());
  };

  return <div className="app-shell">
    <header className="site-header">
      <a className="wordmark" href="./" aria-label="PAC-SAN ホーム"><span className="pac-mark" />PAC-SAN</a>
      <div className="edition"><span className="status-light" />PHASE 02 <span>/</span> GHOST AI</div>
    </header>

    <main className="game-layout">
      <section className="arcade" aria-label="ゲーム画面">
        <div className="arcade-top"><span>01 <span className="muted">/ MAZE ACTION</span></span><span className="live-state"><i className={snapshot.state === 'PLAYING' ? 'active' : ''} />{STATE_LABELS[snapshot.state]}</span></div>
        <div className="screen-bezel">
          <GameCanvas engine={engine} onSnapshot={setSnapshot} />
          {snapshot.debug && <DebugDisplayControls display={snapshot.debugDisplay} onChange={changeDebugDisplay} />}
        </div>
        <div className="arcade-bottom"><span>224 × 288 <span className="muted">PX</span></span><span>60 <span className="muted">HZ</span></span><span className="muted">CANVAS 2D</span></div>
      </section>

      <aside className="side-panel">
        <section className="run-stats" aria-label="プレイ状況">
          <div className="stat-heading"><span>DOTS COLLECTED</span><span>ROUND 01</span></div>
          <div className="dot-count"><strong>{String(snapshot.collectedDots).padStart(3, '0')}</strong><span>/ {TOTAL_DOTS}</span></div>
          <div className="progress-track" role="progressbar" aria-label="ドット取得数" aria-valuemin={0} aria-valuemax={TOTAL_DOTS} aria-valuenow={snapshot.collectedDots}><span style={{ width: `${snapshot.collectedDots / TOTAL_DOTS * 100}%` }} /></div>
          <div className="dot-legend"><span><i />10 PTS</span><span><i className="power-dot" />50 PTS</span></div>
        </section>
        <div className="actions">
          <button className="primary-button" onClick={() => engine.start()} disabled={!canStart}>{snapshot.state === 'LEVEL_CLEAR' ? 'もう一度プレイ' : canStart ? 'ゲームをはじめる' : 'プレイ進行中'}<kbd>ENTER</kbd></button>
          <button className="secondary-button" onClick={() => engine.togglePause()} disabled={!canPause}>{snapshot.state === 'PAUSED' ? '▶ 再開する' : 'Ⅱ 一時停止'}<kbd>P / ESC</kbd></button>
        </div>
        <section className="controls" aria-label="操作方法"><h2>HOW TO PLAY</h2>
          <div className="movement-controls"><div className="direction-pad">
            <button className="up" aria-label="上へ移動" onClick={() => move('up')}>↑</button>
            <button className="left" aria-label="左へ移動" onClick={() => move('left')}>←</button>
            <button className="down" aria-label="下へ移動" onClick={() => move('down')}>↓</button>
            <button className="right" aria-label="右へ移動" onClick={() => move('right')}>→</button>
          </div><p>矢印キー / WASD<span>曲がる方向は先に入力できます</span></p></div>
          <div className="debug-control"><span>デバッグ表示</span><button onClick={toggleDebug} aria-pressed={snapshot.debug}><kbd>F3</kbd><span>{snapshot.debug ? 'ON' : 'OFF'}</span></button></div>
        </section>
        <div className="phase-note"><span>DEVELOPMENT BUILD</span><p>Phase 2：4体のゴーストAIまで実装。<br />接触・残機・面進行は今後追加します。</p></div>
        {snapshot.debug && <DebugPanel snapshot={snapshot}
          onAutoPlayChange={changeAutoPlay}
          onClose={toggleDebug} />}
      </aside>
    </main>
    <footer className="site-footer"><span>PAC-SAN <span className="muted">/ パックサン</span></span><span>1980 ARCADE RECREATION <span className="footer-divider">·</span> v0.2.1</span></footer>
    <div className="sr-only" role="status" aria-live="polite">{STATE_LABELS[snapshot.state]}</div>
  </div>;
}
