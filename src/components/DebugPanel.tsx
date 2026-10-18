import { FIXED_FPS } from '../config/constants';
import { LEVEL_ONE } from '../config/levelTables';
import type { GameEngine } from '../engine/GameEngine';
import type { AutoPlayLevel } from '../ai/AutoPlayer';

const shortDirection = { up: 'U', left: 'L', down: 'D', right: 'R' } as const;

export function DebugPanel({ snapshot, onAutoPlayChange, onHistoryRecordingChange, onHistoryExport, onClose }: {
  snapshot: ReturnType<GameEngine['snapshot']>;
  onAutoPlayChange: (level: AutoPlayLevel | null) => void;
  onHistoryRecordingChange: (recording: boolean) => void;
  onHistoryExport: () => void;
  onClose: () => void;
}) {
  const { player } = snapshot;
  const modeTime = snapshot.frightenedFramesRemaining > 0
    ? `${(snapshot.frightenedFramesRemaining / FIXED_FPS).toFixed(1)}s`
    : snapshot.ghostModeFramesRemaining === null
    ? '∞'
    : `${(snapshot.ghostModeFramesRemaining / FIXED_FPS).toFixed(1)}s`;

  return <section className="debug-panel" aria-label="デバッグ情報">
    <div className="debug-heading">
      <span>ENGINE INSPECTOR</span>
      <button onClick={onClose} aria-label="デバッグ情報を閉じる"><kbd>F3</kbd> ×</button>
    </div>
    {snapshot.debugDisplay.autoPlay && <div className="auto-play-control">
      <label htmlFor="auto-play-level">自動操作</label>
      <select id="auto-play-level" aria-label="オートプレイの操作レベル"
        value={snapshot.autoPlayLevel ?? 'off'}
        onChange={(event) => onAutoPlayChange(event.target.value === 'off' ? null : event.target.value as AutoPlayLevel)}>
        <option value="off">OFF</option>
        <option value="beginner">初心者</option>
        <option value="standard">標準</option>
        <option value="expert">上級</option>
        <option value="tas">TAS</option>
      </select>
      <span>{snapshot.autoPlayTarget ? `→ ${snapshot.autoPlayTarget.x},${snapshot.autoPlayTarget.y}` : '目標 —'}</span>
    </div>}
    <div className="history-control" aria-label="ゲーム履歴">
      <span title="直近10分のフレームを保持します。上限を超えると古い記録から破棄します。">
        {snapshot.history.recording ? '● 記録中' : '履歴'} {snapshot.history.frames.toLocaleString()}F
        {(snapshot.history.droppedFrames > 0 || snapshot.history.droppedEvents > 0)
          && <small title="古い履歴は上限により破棄されました"> · 一部省略</small>}
      </span>
      <button type="button" onClick={() => onHistoryRecordingChange(!snapshot.history.recording)}>
        {snapshot.history.recording ? '停止' : '記録開始'}
      </button>
      <button type="button" onClick={onHistoryExport} disabled={snapshot.history.frames === 0}>
        JSON出力
      </button>
    </div>
    {snapshot.debugDisplay.engineStats && <dl className="debug-summary">
      <dt>状態 / 残機</dt><dd>{snapshot.state} / {snapshot.lives}</dd>
      <dt>ステージ / F</dt><dd>{snapshot.level} / {snapshot.frame}</dd>
      <dt>プレイヤー</dt><dd>{player.x},{player.y} {shortDirection[player.direction]}</dd>
      <dt>タイル / 予約</dt><dd>{player.tileX},{player.tileY} {shortDirection[player.requestedDirection]}</dd>
      <dt>速度</dt><dd>{LEVEL_ONE.playerSpeedPercent}% · {LEVEL_ONE.ghostSpeedPercent}%</dd>
      <dt>残ドット</dt><dd>{snapshot.remainingDots} · 果実 {snapshot.fruit.visible ? `${snapshot.fruit.kind} ${snapshot.fruit.framesRemaining}F` : '—'}</dd>
      <dt>モード</dt><dd>{snapshot.frightenedFramesRemaining > 0 ? 'FRIGHTENED' : snapshot.ghostMode} · {modeTime}</dd>
      <dt>巣カウンタ</dt><dd>{snapshot.ghostHouse.dotCounter} · {snapshot.ghostHouse.idleFrames}F</dd>
    </dl>}
    {snapshot.debugDisplay.ghostTable && <table className="ghost-debug">
      <thead><tr><th>GHOST</th><th>POS / DIR</th><th>TARGET</th></tr></thead>
      <tbody>{snapshot.ghosts.map((ghost) => <tr key={ghost.id}>
        <th style={{ color: ghost.color }}>{ghost.displayName}</th>
        <td>{ghost.tileX},{ghost.tileY} {shortDirection[ghost.direction]}<small>{ghost.state === 'NORMAL' ? ghost.mode : ghost.state} · {ghost.houseState}</small></td>
        <td>{ghost.targetTile.x},{ghost.targetTile.y}<small>{ghost.lastDecision?.candidates.map((direction) => shortDirection[direction]).join('') || '—'}</small></td>
      </tr>)}</tbody>
    </table>}
  </section>;
}
