import { useState } from 'react';
import { SoundEngine } from './audio/SoundEngine';
import { GameCanvas } from './components/GameCanvas';
import { FruitPickupHistory } from './components/FruitPickupHistory';
import { DebugPanel } from './components/DebugPanel';
import { DebugDisplayControls } from './components/DebugDisplayControls';
import { TOTAL_DOTS, type Direction } from './config/constants';
import { GameEngine } from './engine/GameEngine';
import type { DebugDisplayKey } from './engine/DebugDisplay';
import type { AutoPlayLevel } from './ai/AutoPlayer';
import type { GameState } from './engine/GameState';
import { loadHighScore } from './storage/highScore';

const STATE_LABELS: Record<GameState, string> = {
  TITLE: '開始待ち', READY: '準備中', PLAYING: 'プレイ中', PAUSED: '一時停止',
  PLAYER_DYING: 'ミス', LEVEL_CLEAR: '迷路クリア', GAME_OVER: 'ゲームオーバー',
};

export default function App() {
  const [engine] = useState(() => new GameEngine(loadHighScore()));
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('pac-san-sound-enabled') !== 'false'; }
    catch { return true; }
  });
  const [sound] = useState(() => new SoundEngine(soundEnabled));
  const [snapshot, setSnapshot] = useState(() => engine.snapshot());
  const canPause = ['READY', 'PLAYING', 'PAUSED'].includes(snapshot.state);
  const canStart = snapshot.state === 'TITLE' || snapshot.state === 'GAME_OVER';
  const move = (direction: Direction) => {
    engine.requestDirection(direction);
    setSnapshot(engine.snapshot());
  };
  const changeAutoPlay = (level: AutoPlayLevel | null) => {
    engine.setAutoPlayLevel(level);
    setSnapshot(engine.snapshot());
  };
  const changeHistoryRecording = (recording: boolean) => {
    engine.setHistoryRecording(recording);
    setSnapshot(engine.snapshot());
  };
  const exportHistory = () => {
    if (engine.history.summary.frames === 0) return;
    const json = JSON.stringify(engine.history.exportData());
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `pac-san-history-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const toggleDebug = () => {
    engine.toggleDebug();
    setSnapshot(engine.snapshot());
  };
  const changeDebugDisplay = (key: DebugDisplayKey, visible: boolean) => {
    engine.setDebugDisplayOption(key, visible);
    setSnapshot(engine.snapshot());
  };
  const toggleSound = () => {
    const enabled = !soundEnabled;
    sound.setEnabled(enabled);
    setSoundEnabled(enabled);
    try { localStorage.setItem('pac-san-sound-enabled', String(enabled)); }
    catch { /* The setting still works for this session. */ }
  };

  return <div className="app-shell">
    <header className="site-header">
      <a className="wordmark" href="./" aria-label="PAC-SAN ホーム"><span className="pac-mark" />PAC-SAN</a>
      <div className="edition"><span className="status-light" />PHASE 03 <span>/</span> GAME SYSTEMS</div>
    </header>

    <main className="game-layout">
      <section className="arcade" aria-label="ゲーム画面">
        <div className="arcade-top"><span>{String(snapshot.level).padStart(2, '0')} <span className="muted">/ MAZE ACTION</span></span><span className="live-state"><i className={snapshot.state === 'PLAYING' ? 'active' : ''} />{STATE_LABELS[snapshot.state]}</span></div>
        <div className="screen-bezel">
          <GameCanvas engine={engine} sound={sound} onSnapshot={setSnapshot} />
          {snapshot.debug && <DebugDisplayControls display={snapshot.debugDisplay} onChange={changeDebugDisplay} />}
        </div>
        <div className="arcade-bottom"><span>224 × 288 <span className="muted">PX</span></span><span>60 <span className="muted">HZ</span></span><span className="muted">CANVAS 2D</span></div>
      </section>

      <aside className="side-panel">
        <section className="run-stats" aria-label="プレイ状況">
          <div className="stat-heading"><span>DOTS COLLECTED</span><span>ROUND {String(snapshot.level).padStart(2, '0')}</span></div>
          <div className="dot-count"><strong>{String(snapshot.collectedDots).padStart(3, '0')}</strong><span>/ {TOTAL_DOTS}</span></div>
          <div className="progress-track" role="progressbar" aria-label="ドット取得数" aria-valuemin={0} aria-valuemax={TOTAL_DOTS} aria-valuenow={snapshot.collectedDots}><span style={{ width: `${snapshot.collectedDots / TOTAL_DOTS * 100}%` }} /></div>
          <div className="dot-legend"><span><i />10 PTS</span><span><i className="power-dot" />50 PTS</span></div>
          <div className="run-details"><span>残機 <strong>{snapshot.lives}</strong></span><span>フルーツ <strong>{snapshot.fruit.visible ? `${snapshot.fruit.kind.toUpperCase()} +${snapshot.fruit.points}` : '—'}</strong></span></div>
          <div className="fruit-pickups" aria-live="polite">
            <span>取得 <strong>{String(snapshot.fruitPickupCount).padStart(2, '0')}</strong></span>
            <FruitPickupHistory fruits={snapshot.collectedFruits} />
          </div>
        </section>
        <div className="actions">
          <button className="primary-button" onClick={() => engine.start()} disabled={!canStart}>{snapshot.state === 'GAME_OVER' ? 'もう一度プレイ' : canStart ? 'ゲームをはじめる' : 'プレイ進行中'}<kbd>ENTER</kbd></button>
          <button className="secondary-button" onClick={() => engine.togglePause()} disabled={!canPause}>{snapshot.state === 'PAUSED' ? '▶ 再開する' : 'Ⅱ 一時停止'}<kbd>P / ESC</kbd></button>
        </div>
        <section className="controls" aria-label="操作方法"><h2>HOW TO PLAY</h2>
          <div className="movement-controls"><div className="direction-pad">
            <button className="up" aria-label="上へ移動" onClick={() => move('up')}>↑</button>
            <button className="left" aria-label="左へ移動" onClick={() => move('left')}>←</button>
            <button className="down" aria-label="下へ移動" onClick={() => move('down')}>↓</button>
            <button className="right" aria-label="右へ移動" onClick={() => move('right')}>→</button>
          </div><p>矢印キー / WASD<span>曲がる方向は先に入力できます</span></p></div>
          <div className="debug-control"><span>設定</span><div className="quick-toggles">
            <button onClick={toggleSound} aria-label={`サウンドを${soundEnabled ? 'オフ' : 'オン'}にする`} aria-pressed={soundEnabled}><kbd>♪</kbd><span>{soundEnabled ? 'ON' : 'OFF'}</span></button>
            <button onClick={toggleDebug} aria-label={`デバッグ表示を${snapshot.debug ? 'オフ' : 'オン'}にする`} aria-pressed={snapshot.debug}><kbd>F3</kbd><span>{snapshot.debug ? 'ON' : 'OFF'}</span></button>
          </div></div>
        </section>
        <div className="phase-note"><span>DEVELOPMENT BUILD</span><p>Phase 3：恐怖・捕食、残機、フルーツ、面進行に対応。<br />細部の原作照合は今後進めます。</p></div>
        {snapshot.debug && <DebugPanel snapshot={snapshot}
          onAutoPlayChange={changeAutoPlay}
          onHistoryRecordingChange={changeHistoryRecording}
          onHistoryExport={exportHistory}
          onClose={toggleDebug} />}
      </aside>
    </main>
    <footer className="site-footer"><span>PAC-SAN <span className="muted">/ パックサン</span></span><span>1980 ARCADE RECREATION <span className="footer-divider">·</span> v0.3.1</span></footer>
    <div className="sr-only" role="status" aria-live="polite">{STATE_LABELS[snapshot.state]}</div>
    <div className="sr-only" role="status" aria-live="polite">{snapshot.fruitScorePopup ? `フルーツ獲得、${snapshot.fruitScorePopup.points}点` : ''}</div>
  </div>;
}
