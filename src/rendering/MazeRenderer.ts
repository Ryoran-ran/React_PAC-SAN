import { COLORS, MAZE_COLUMNS, MAZE_ROWS, TILE_SIZE } from '../config/constants';
import { tileType } from '../map/tileRules';

type Point = { x: number; y: number };
type Edge = { from: Point; to: Point };
const key = (p: Point) => `${p.x},${p.y}`;

/** Builds visual contours once. These paths are never consulted by collision rules. */
export class MazeRenderer {
  private contours: Point[][] = [];

  constructor() {
    const edges: Edge[] = [];
    const isWall = (x: number, y: number) => tileType(x, y) === 'wall';
    for (let y = 0; y < MAZE_ROWS; y++) {
      for (let x = 0; x < MAZE_COLUMNS; x++) {
        if (!isWall(x, y)) continue;
        if (!isWall(x, y - 1)) edges.push({ from: { x, y }, to: { x: x + 1, y } });
        if (!isWall(x + 1, y)) edges.push({ from: { x: x + 1, y }, to: { x: x + 1, y: y + 1 } });
        if (!isWall(x, y + 1)) edges.push({ from: { x: x + 1, y: y + 1 }, to: { x, y: y + 1 } });
        if (!isWall(x - 1, y)) edges.push({ from: { x, y: y + 1 }, to: { x, y } });
      }
    }
    const outgoing = new Map<string, Edge[]>();
    for (const edge of edges) {
      const list = outgoing.get(key(edge.from)) ?? [];
      list.push(edge);
      outgoing.set(key(edge.from), list);
    }
    const unused = new Set(edges);
    while (unused.size) {
      const first = unused.values().next().value as Edge;
      const points: Point[] = [];
      let edge: Edge | undefined = first;
      while (edge && unused.has(edge)) {
        points.push(edge.from);
        unused.delete(edge);
        const candidates: Edge[] = (outgoing.get(key(edge.to)) ?? []).filter(candidate => unused.has(candidate));
        const dx: number = edge.to.x - edge.from.x;
        const dy: number = edge.to.y - edge.from.y;
        // At diagonal contacts, keep the wall on the right.
        edge = candidates.find(candidate => {
          const nx = candidate.to.x - candidate.from.x;
          const ny = candidate.to.y - candidate.from.y;
          return dx * ny - dy * nx > 0;
        }) ?? candidates[0];
      }
      // Remove collinear points before applying a two-pixel visual inset.
      const corners = points.filter((point, i) => {
        const prev = points[(i + points.length - 1) % points.length];
        const next = points[(i + 1) % points.length];
        return (point.x - prev.x) * (next.y - point.y) !== (point.y - prev.y) * (next.x - point.x);
      });
      if (corners.length < 3) continue;
      this.contours.push(corners.map((point, i) => {
        const prev = corners[(i + corners.length - 1) % corners.length];
        const next = corners[(i + 1) % corners.length];
        return {
          x: point.x * TILE_SIZE - 2 * (Math.sign(point.y - prev.y) + Math.sign(next.y - point.y)),
          y: point.y * TILE_SIZE + 2 * (Math.sign(point.x - prev.x) + Math.sign(next.x - point.x)),
        };
      }));
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.strokeStyle = COLORS.wall;
    context.lineWidth = 1;
    context.lineJoin = 'round';
    for (const contour of this.contours) {
      context.beginPath();
      for (let i = 0; i < contour.length; i++) {
        const p = contour[i];
        const prev = contour[(i + contour.length - 1) % contour.length];
        const next = contour[(i + 1) % contour.length];
        const before = { x: p.x - Math.sign(p.x - prev.x) * 2, y: p.y - Math.sign(p.y - prev.y) * 2 };
        const after = { x: p.x + Math.sign(next.x - p.x) * 2, y: p.y + Math.sign(next.y - p.y) * 2 };
        if (i === 0) context.moveTo(before.x, before.y);
        else context.lineTo(before.x, before.y);
        context.quadraticCurveTo(p.x, p.y, after.x, after.y);
      }
      context.closePath();
      context.stroke();
    }
    context.fillStyle = COLORS.gate;
    context.fillRect(13 * TILE_SIZE, 12 * TILE_SIZE + 2, 2 * TILE_SIZE, 2);
  }
}
