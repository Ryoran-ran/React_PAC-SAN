import { TILE_CENTER, TILE_SIZE, type Direction } from '../config/constants';

export type GhostId = 'blinky' | 'pinky' | 'inky' | 'clyde';
export type GhostMode = 'SCATTER' | 'CHASE';
export type GhostHouseState = 'OUTSIDE' | 'PACING_HOME' | 'LEAVING_HOME' | 'RETURNING_HOME';
export type GhostState = 'NORMAL' | 'FRIGHTENED' | 'EATEN';

export interface TilePoint {
  readonly x: number;
  readonly y: number;
}

export interface GhostDecision {
  readonly tile: TilePoint;
  readonly candidates: readonly Direction[];
  readonly chosen: Direction;
}

interface GhostDefinition {
  readonly id: GhostId;
  readonly displayName: string;
  readonly color: string;
  readonly startTile: TilePoint;
  readonly startDirection: Direction;
  readonly startHouseState: GhostHouseState;
  readonly scatterTarget: TilePoint;
}

const GHOST_DEFINITIONS: readonly GhostDefinition[] = [
  {
    id: 'blinky', displayName: 'AKABEI', color: '#ff4b44',
    startTile: { x: 13, y: 11 }, startDirection: 'left',
    startHouseState: 'OUTSIDE', scatterTarget: { x: 25, y: -3 },
  },
  {
    id: 'pinky', displayName: 'PINKY', color: '#ffb8de',
    startTile: { x: 13, y: 14 }, startDirection: 'down',
    startHouseState: 'PACING_HOME', scatterTarget: { x: 2, y: -3 },
  },
  {
    id: 'inky', displayName: 'AOSUKE', color: '#35e8ed',
    startTile: { x: 11, y: 14 }, startDirection: 'up',
    startHouseState: 'PACING_HOME', scatterTarget: { x: 27, y: 31 },
  },
  {
    id: 'clyde', displayName: 'GUZUTA', color: '#ffad42',
    startTile: { x: 15, y: 14 }, startDirection: 'up',
    startHouseState: 'PACING_HOME', scatterTarget: { x: 0, y: 31 },
  },
];

export class Ghost {
  public x = 0;
  public y = 0;
  public direction: Direction;
  public mode: GhostMode = 'SCATTER';
  public state: GhostState = 'NORMAL';
  public houseState: GhostHouseState;
  public targetTile: TilePoint;
  public pendingReverse = false;
  public reversalTile: string | null = null;
  public movementFrame = 0;
  public stepsMoved = 0;
  public moving = false;
  public lastDecision: GhostDecision | null = null;

  public constructor(private readonly definition: GhostDefinition) {
    this.direction = definition.startDirection;
    this.houseState = definition.startHouseState;
    this.targetTile = definition.scatterTarget;
    this.reset();
  }

  public get id(): GhostId { return this.definition.id; }
  public get displayName(): string { return this.definition.displayName; }
  public get color(): string { return this.definition.color; }
  public get scatterTarget(): TilePoint { return this.definition.scatterTarget; }

  public reset(): void {
    this.x = this.definition.startTile.x * TILE_SIZE + TILE_SIZE / 2;
    this.y = this.definition.startTile.y * TILE_SIZE + TILE_SIZE / 2;
    this.direction = this.definition.startDirection;
    this.mode = 'SCATTER';
    this.state = 'NORMAL';
    this.houseState = this.definition.startHouseState;
    this.targetTile = this.definition.scatterTarget;
    this.pendingReverse = false;
    this.reversalTile = null;
    this.movementFrame = 0;
    this.stepsMoved = 0;
    this.moving = false;
    this.lastDecision = null;
  }

  public requestReverse(): void {
    if (this.houseState !== 'OUTSIDE') return;
    this.pendingReverse = true;
    const atCenter = this.x % TILE_SIZE === TILE_CENTER && this.y % TILE_SIZE === TILE_CENTER;
    let tileX = Math.floor(this.x / TILE_SIZE);
    let tileY = Math.floor(this.y / TILE_SIZE);
    if (!atCenter) {
      if (this.direction === 'right') tileX = Math.floor((this.x - TILE_CENTER) / TILE_SIZE) + 1;
      if (this.direction === 'left') tileX = Math.ceil((this.x - TILE_CENTER) / TILE_SIZE) - 1;
      if (this.direction === 'down') tileY = Math.floor((this.y - TILE_CENTER) / TILE_SIZE) + 1;
      if (this.direction === 'up') tileY = Math.ceil((this.y - TILE_CENTER) / TILE_SIZE) - 1;
    }
    this.reversalTile = `${tileX},${tileY}`;
  }
}

export function createGhosts(): Ghost[] {
  return GHOST_DEFINITIONS.map((definition) => new Ghost(definition));
}
