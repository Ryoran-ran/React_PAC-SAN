import { LEVEL_ONE } from '../config/levelTables';
import type { GameEngine } from '../engine/GameEngine';

export function DebugPanel({ snapshot, onClose }: {
  snapshot: ReturnType<GameEngine['snapshot']>;
  onClose: () => void;
}) {
  const { player } = snapshot;
  return <section className="debug-panel" aria-label="デバッグ情報">
    <div className="debug-heading"><span>ENGINE INSPECTOR</span><button onClick={onClose} aria-label="デバッグ情報を閉じる"><kbd>F3</kbd> ×</button></div>
    <dl>
      <dt>状態</dt><dd>{snapshot.state}</dd>
      <dt>ステージ / フレーム</dt><dd>{snapshot.level} / {snapshot.frame}</dd>
      <dt>プレイフレーム</dt><dd>{snapshot.playFrame}</dd>
      <dt>座標 px</dt><dd>{player.x}, {player.y}</dd>
      <dt>タイル</dt><dd>{player.tileX}, {player.tileY}</dd>
      <dt>方向 / 予約方向</dt><dd>{player.direction} / {player.requestedDirection}</dd>
      <dt>速度</dt><dd>{LEVEL_ONE.playerSpeedPercent}% · 1 px/frame</dd>
      <dt>停止フレーム</dt><dd>{player.freezeFrames}</dd>
      <dt>残りドット</dt><dd>{snapshot.remainingDots}</dd>
    </dl>
    <p>ゴースト・乱数・ターゲット表示はPhase 2以降に実装予定。</p>
  </section>;
}
