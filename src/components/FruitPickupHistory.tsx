import { useEffect, useRef } from 'react';
import type { FruitKind } from '../config/levelTables';
import { drawFruit } from '../rendering/FruitSprites';

const FRUIT_NAMES: Record<FruitKind, string> = {
  cherry: 'さくらんぼ', strawberry: 'いちご', peach: 'オレンジ', apple: 'りんご',
  melon: 'メロン', galaxian: 'ギャラクシアン', bell: 'ベル', key: '鍵',
};

export function FruitPickupHistory({ fruits }: { fruits: readonly FruitKind[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleFruits = fruits.slice(0, 7);
  const signature = visibleFruits.join(',');

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, 112, 16);
    context.imageSmoothingEnabled = false;
    visibleFruits.forEach((kind, index) => {
      drawFruit(context, kind, 104 - (visibleFruits.length - index - 1) * 16, 8);
    });
  }, [signature]);

  if (visibleFruits.length === 0) return <span className="fruit-history-empty">—</span>;
  return <canvas ref={canvasRef} width={112} height={16} role="img"
    aria-label={`取得したフルーツ: ${visibleFruits.map((kind) => FRUIT_NAMES[kind]).join('、')}`} />;
}
