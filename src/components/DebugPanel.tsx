import { FIXED_FPS } from '../config/constants';
import { LEVEL_ONE } from '../config/levelTables';
import type { GameEngine } from '../engine/GameEngine';

const shortDirection = { up: 'U', left: 'L', down: 'D', right: 'R' } as const;

export function DebugPanel({ snapshot, onClose }: {
  snapshot: ReturnType<GameEngine['snapshot']>;
  onClose: () => void;
}) {
  const { player } = snapshot;
  const modeTime = snapshot.ghostModeFramesRemaining === null
    ? '∞'
    : `${(snapshot.ghostModeFramesRemaining / FIXED_FPS).toFixed(1)}s`;

  return <section className="debug-panel" aria-label="デバッグ情報">
    <div className="debug-heading">
      <span>ENGINE INSPECTOR</span>
      <button onClick={onClose} aria-label="デバッグ情報を閉じる"><kbd>F3</kbd> ×</button>
    </div>
    <dl className="debug-summary">
      <dt>状態</dt><dd>{snapshot.state}</dd>
      <dt>ステージ / F</dt><dd>{snapshot.level} / {snapshot.frame}</dd>
      <dt>プレイヤー</dt><dd>{player.x},{player.y} {shortDirection[player.direction]}</dd>
      <dt>タイル / 予約</dt><dd>{player.tileX},{player.tileY} {shortDirection[player.requestedDirection]}</dd>
      <dt>速度</dt><dd>{LEVEL_ONE.playerSpeedPercent}% · {LEVEL_ONE.ghostSpeedPercent}%</dd>
      <dt>残ドット</dt><dd>{snapshot.remainingDots}</dd>
      <dt>モード</dt><dd>{snapshot.ghostMode} · {modeTime}</dd>
      <dt>巣カウンタ</dt><dd>{snapshot.ghostHouse.dotCounter} · {snapshot.ghostHouse.idleFrames}F</dd>
    </dl>
    <table className="ghost-debug">
      <thead><tr><th>GHOST</th><th>POS / DIR</th><th>TARGET</th></tr></thead>
      <tbody>{snapshot.ghosts.map((ghost) => <tr key={ghost.id}>
        <th style={{ color: ghost.color }}>{ghost.displayName}</th>
        <td>{ghost.tileX},{ghost.tileY} {shortDirection[ghost.direction]}<small>{ghost.mode} · {ghost.houseState}</small></td>
        <td>{ghost.targetTile.x},{ghost.targetTile.y}<small>{ghost.lastDecision?.candidates.map((direction) => shortDirection[direction]).join('') || '—'}</small></td>
      </tr>)}</tbody>
    </table>
  </section>;
}
