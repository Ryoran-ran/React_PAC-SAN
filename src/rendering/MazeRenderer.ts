import arcadeMazeUrl from '../assets/arcade-maze.png';
import { COLORS, MAZE_COLUMNS, MAZE_OFFSET_Y, MAZE_ROWS, SCREEN_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from '../config/constants';
import { tileType } from '../map/tileRules';

type Point = { x: number; y: number };
type Edge = { from: Point; to: Point };
const key = (p: Point) => `${p.x},${p.y}`;

/** Builds visual contours once. These paths are never consulted by collision rules. */
export class MazeRenderer {
  private contours: Point[][] = [];
  private arcadeImage: HTMLImageElement | null = null;

  constructor() {
    if (typeof Image !== 'undefined') {
      this.arcadeImage = new Image();
      this.arcadeImage.src = arcadeMazeUrl;
    }
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
    // Pixel-exact transparent maze art from the arcade sprite reference. The
    // generated contour below is a fallback until the image has loaded.
    if (this.arcadeImage?.complete
      && this.arcadeImage.naturalWidth === SCREEN_WIDTH
      && this.arcadeImage.naturalHeight === SCREEN_HEIGHT) {
      context.drawImage(this.arcadeImage, 0, -MAZE_OFFSET_Y);
    } else {
      context.fillStyle = COLORS.wall;
      for (const contour of this.contours) {
        const radiusAt = (index: number): number => {
          const point = contour[index];
          const before = contour[(index + contour.length - 1) % contour.length];
          const after = contour[(index + 1) % contour.length];
          const incomingLength = Math.abs(point.x - before.x) + Math.abs(point.y - before.y);
          const outgoingLength = Math.abs(after.x - point.x) + Math.abs(after.y - point.y);
          return Math.max(1, Math.min(3, Math.floor(Math.min(incomingLength, outgoingLength) / 2)));
        };
        for (let i = 0; i < contour.length; i++) {
          const p = contour[i];
          const prev = contour[(i + contour.length - 1) % contour.length];
          const next = contour[(i + 1) % contour.length];
          const incoming = { x: Math.sign(p.x - prev.x), y: Math.sign(p.y - prev.y) };
          const outgoing = { x: Math.sign(next.x - p.x), y: Math.sign(next.y - p.y) };
          const radius = radiusAt(i);
          const previousRadius = radiusAt((i + contour.length - 1) % contour.length);
          const start = { x: prev.x + incoming.x * previousRadius, y: prev.y + incoming.y * previousRadius };
          const end = { x: p.x - incoming.x * radius, y: p.y - incoming.y * radius };
          // Draw the wall as solid logical pixels until the image is ready.
          context.fillRect(Math.min(start.x, end.x), Math.min(start.y, end.y),
            Math.abs(end.x - start.x) + 1, Math.abs(end.y - start.y) + 1);
          for (let step = 1; step <= radius; step++) {
            context.fillRect(p.x - incoming.x * (radius - step) + outgoing.x * (step - 1),
              p.y - incoming.y * (radius - step) + outgoing.y * (step - 1), 1, 1);
          }
        }
      }
      context.fillStyle = COLORS.gate;
      context.fillRect(13 * TILE_SIZE, 12 * TILE_SIZE + 5, 2 * TILE_SIZE, 2);
    }
  }
}
