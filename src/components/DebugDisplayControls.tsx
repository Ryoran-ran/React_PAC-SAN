import { useState } from 'react';
import type { DebugDisplayKey, DebugDisplayOptions } from '../engine/DebugDisplay';

const options: { key: DebugDisplayKey; label: string }[] = [
  { key: 'mazeGrid', label: '迷路グリッド' },
  { key: 'playerCenter', label: '自機の中心' },
  { key: 'ghostTargets', label: '敵の目標線' },
  { key: 'directionChoices', label: '敵の進路候補' },
  { key: 'autoPlay', label: '自動操作' },
  { key: 'engineStats', label: 'ゲーム状態' },
  { key: 'ghostTable', label: '敵の情報' },
];

export function DebugDisplayControls({ display, onChange }: {
  display: DebugDisplayOptions;
  onChange: (key: DebugDisplayKey, visible: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return <div className="debug-display-menu">
    <button className="debug-display-toggle" type="button" aria-expanded={expanded}
      aria-controls="debug-display-options" onClick={() => setExpanded(!expanded)}>
      表示設定 <span aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>
    {expanded && <div id="debug-display-options" className="debug-display-options" role="group" aria-label="デバッグ表示項目">
      {options.map(({ key, label }) => <label key={key}>
        <input type="checkbox" checked={display[key]} onChange={(event) => onChange(key, event.target.checked)} />
        <span>{label}</span>
      </label>)}
    </div>}
  </div>;
}
