import type { FreePlaySettings, GameMode } from '../engine/GameModes';

type StartScreenView = 'modes' | 'freeplay-settings';

export function StartScreen({ gameOver, score, view, selectedMode, settings, onModeChange,
  onSettingsChange, onBack, onStart }: {
  gameOver: boolean;
  score: number;
  view: StartScreenView;
  selectedMode: GameMode;
  settings: FreePlaySettings;
  onModeChange: (mode: GameMode) => void;
  onSettingsChange: (settings: FreePlaySettings) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const configuring = view === 'freeplay-settings';
  return <section className="start-screen" role="dialog" aria-modal="true" aria-labelledby="start-title">
    <div className="start-intro">
      <div className="start-kicker"><span className="status-light" /> SELECT MODE / PAC-SAN</div>
      <div className="start-mark" aria-hidden="true"><span className="start-pac" /><i /><i /><i /><i /></div>
      <h1 id="start-title">{configuring ? 'FREE PLAY' : gameOver ? 'GAME OVER' : 'PAC-SAN'}</h1>
      <p>{configuring ? '遊びたいラウンドとゴーストの数を選択。'
        : gameOver ? `SCORE ${String(score).padStart(6, '0')}` : '迷路の先へ。遊び方を選んでスタート。'}</p>
      <div className="start-hint">{configuring
        ? 'Tab：設定と決定ボタン　·　Enter：盤面へ'
        : '↑↓ / W S / 1 2：モード選択　·　Enter：盤面へ'}</div>
    </div>

    <div className="start-options">
      {configuring ? <>
        <div className="start-options-heading"><span>02 / FREE PLAY SETTINGS</span>
          <button type="button" className="start-back" onClick={onBack}>← モード選択</button></div>
        <p className="setup-copy">ミスしても残機は減らず、同じラウンドから再開します。</p>
        <div className="freeplay-settings" aria-label="フリープレイ設定">
          <label>開始ラウンド
            <input type="number" min="1" max="255" step="1" value={settings.startLevel}
              onChange={(event) => onSettingsChange({ ...settings, startLevel: Number(event.target.value) })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault(); event.stopPropagation(); onStart();
                }
              }} />
          </label>
          <label>ゴーストの数
            <select value={settings.ghostCount}
              onChange={(event) => onSettingsChange({ ...settings, ghostCount: Number(event.target.value) })}>
              <option value={0}>0体</option><option value={1}>1体</option><option value={2}>2体</option>
              <option value={3}>3体</option><option value={4}>4体</option>
            </select>
          </label>
        </div>
        <p className="setup-footnote">フリープレイの得点はアーケードのハイスコアに反映されません。</p>
        <button type="button" className="start-play" onClick={onStart}>
          <span>設定を決めて盤面へ</span><span>ENTER →</span>
        </button>
      </> : <>
      <div className="start-options-heading"><span>01 / GAME MODE</span><span>2 MODES AVAILABLE</span></div>
      <div className="mode-list" role="group" aria-label="ゲームモード">
        <button className={`mode-card${selectedMode === 'arcade' ? ' selected' : ''}`}
          type="button" aria-pressed={selectedMode === 'arcade'} onClick={(event) => {
            onModeChange('arcade'); event.currentTarget.blur();
          }}>
          <span className="mode-number">01</span><span className="mode-copy"><strong>アーケード</strong><small>3機から始める、いつものPAC-SAN</small></span>
          <span className="mode-indicator" aria-hidden="true">{selectedMode === 'arcade' ? '●' : '○'}</span>
        </button>
        <button className={`mode-card${selectedMode === 'freeplay' ? ' selected' : ''}`}
          type="button" aria-pressed={selectedMode === 'freeplay'} onClick={(event) => {
            onModeChange('freeplay'); event.currentTarget.blur();
          }}>
          <span className="mode-number">02</span><span className="mode-copy"><strong>フリープレイ</strong><small>残機無制限・開始ラウンドと敵の数を選択</small></span>
          <span className="mode-indicator" aria-hidden="true">{selectedMode === 'freeplay' ? '●' : '○'}</span>
        </button>
        <div className="mode-card unavailable" aria-disabled="true">
          <span className="mode-number">03</span><span className="mode-copy"><strong>ナイトメア <em>開発予定</em></strong><small>4体のゴーストが連携する新しいAI</small></span>
          <span className="mode-indicator" aria-hidden="true">—</span>
        </div>
      </div>

      <button type="button" className="start-play" onClick={onStart}>
        <span>{selectedMode === 'freeplay' ? '設定を開く' : '盤面へ進む'}</span>
        <span>ENTER →</span>
      </button>
      </>}
    </div>
  </section>;
}
