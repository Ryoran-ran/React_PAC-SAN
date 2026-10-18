import type { FreePlaySettings, GameMode } from '../engine/GameModes';
import type { GhostId } from '../entities/Ghost';

type StartScreenView = 'modes' | 'freeplay-settings';
const GHOST_NAMES: readonly { id: GhostId; name: string }[] = [
  { id: 'blinky', name: 'アカベイ' },
  { id: 'pinky', name: 'ピンキー' },
  { id: 'inky', name: 'アオスケ' },
  { id: 'clyde', name: 'グズタ' },
];

export function StartScreen({ view, selectedMode, settings, onModeActivate,
  onSettingsChange, onBack, onStart }: {
  view: StartScreenView;
  selectedMode: GameMode;
  settings: FreePlaySettings;
  onModeActivate: (mode: GameMode) => void;
  onSettingsChange: (settings: FreePlaySettings) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const configuring = view === 'freeplay-settings';
  return <section className="start-screen" role="dialog" aria-modal="true" aria-labelledby="start-title">
    <div className="start-intro">
      <div className="start-kicker"><span className="status-light" /> SELECT MODE / PAC-SAN</div>
      <div className="start-mark" aria-hidden="true"><span className="start-pac" /><i /><i /><i /><i /></div>
      <h1 id="start-title">{configuring ? 'FREE PLAY' : 'PAC-SAN'}</h1>
      {configuring && <p>ラウンド・ゴーストの数・AIと行動を選択。</p>}
      <div className="start-hint">{configuring
        ? 'Tab：設定と決定ボタン　·　Enter：盤面へ'
        : '↑ / ↓ / 1 2 3 / N：モード選択　·　Enter：盤面へ'}</div>
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
          <label className="ghost-ai-setting">ゴーストAI
            <select value={settings.ghostAI}
              onChange={(event) => onSettingsChange({ ...settings,
                ghostAI: event.target.value === 'nightmare' ? 'nightmare' : 'arcade' })}>
              <option value="arcade">通常</option>
              <option value="nightmare">ナイトメア（連携して追跡）</option>
            </select>
          </label>
          <label className="ghost-ai-setting">ゴーストの行動
            <select value={settings.ghostBehavior}
              onChange={(event) => onSettingsChange({ ...settings,
                ghostBehavior: event.target.value === 'chase' ? 'chase'
                  : event.target.value === 'scatter' ? 'scatter' : 'standard' })}>
              <option value="standard">標準（選択したAIの既定動作）</option>
              <option value="chase">追跡のみ</option>
              <option value="scatter">巡回のみ</option>
            </select>
          </label>
          <details className="ghost-target-settings">
            <summary onKeyDown={(event) => {
              if (event.key === 'Enter') event.stopPropagation();
            }}>ゴースト別の追跡方法</summary>
            <p>通常AIの追跡中に適用します。</p>
            <div className="ghost-target-grid">
              {GHOST_NAMES.map(({ id, name }) => <label key={id}>{name}
                <select value={settings.ghostTargeting[id]}
                  onChange={(event) => onSettingsChange({ ...settings,
                    ghostTargeting: { ...settings.ghostTargeting,
                      [id]: event.target.value as GhostId } })}>
                  {GHOST_NAMES.map((choice) => <option key={choice.id} value={choice.id}>
                    {choice.name}の追跡
                  </option>)}
                </select>
              </label>)}
            </div>
          </details>
        </div>
        <p className="setup-footnote">フリープレイの得点はアーケードのハイスコアに反映されません。</p>
        <button type="button" className="start-play" onClick={onStart}>
          <span>設定を決めて盤面へ</span><span>ENTER →</span>
        </button>
      </> : <>
      <div className="start-options-heading"><span>01 / GAME MODE</span><span>3 MODES AVAILABLE</span></div>
      <div className="mode-list" role="group" aria-label="ゲームモード">
        <button className={`mode-card${selectedMode === 'arcade' ? ' selected' : ''}`}
          type="button" aria-pressed={selectedMode === 'arcade'} onClick={(event) => {
            onModeActivate('arcade'); event.currentTarget.blur();
          }}>
          <span className="mode-number">01</span><span className="mode-copy"><strong>ARCADE</strong><small>3機から始める、いつものPAC-SAN</small></span>
          <span className="mode-indicator" aria-hidden="true">{selectedMode === 'arcade' ? '●' : '○'}</span>
        </button>
        <button className={`mode-card${selectedMode === 'freeplay' ? ' selected' : ''}`}
          type="button" aria-pressed={selectedMode === 'freeplay'} onClick={(event) => {
            onModeActivate('freeplay'); event.currentTarget.blur();
          }}>
          <span className="mode-number">02</span><span className="mode-copy"><strong>FREE PLAY</strong><small>残機無制限・ラウンドと敵の行動を設定</small></span>
          <span className="mode-indicator" aria-hidden="true">{selectedMode === 'freeplay' ? '●' : '○'}</span>
        </button>
        <button className={`mode-card${selectedMode === 'nightmare' ? ' selected' : ''}`}
          type="button" aria-pressed={selectedMode === 'nightmare'} onClick={(event) => {
            onModeActivate('nightmare'); event.currentTarget.blur();
          }}>
          <span className="mode-number">03</span><span className="mode-copy"><strong>NIGHTMARE</strong><small>アーケードルール・4体が連携して追い詰める</small></span>
          <span className="mode-indicator" aria-hidden="true">{selectedMode === 'nightmare' ? '●' : '○'}</span>
        </button>
      </div>

      <button type="button" className="start-play" onClick={onStart}>
        <span>{selectedMode === 'freeplay' ? '設定を開く' : '盤面へ進む'}</span>
        <span>ENTER →</span>
      </button>
      </>}
    </div>
  </section>;
}
