export type ZoneType = 'tee' | 'fairway' | 'green' | 'rough' | 'sand' | 'water';

export type GameState = 'aiming' | 'power' | 'rolling' | 'stopped' | 'holed';

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ZoneData {
  type: ZoneType;
  shape: 'rect' | 'circle';
  position: Vec2;
  size?: { width: number; height: number };
  radius?: number;
}

export interface ObstacleData {
  type: 'tree' | 'rock';
  position: Vec3;
}

export interface CourseData {
  name: string;
  par: number;
  tee: Vec2;
  hole: Vec2;
  zones: ZoneData[];
  obstacles: ObstacleData[];
}

export const ZONE_PHYSICS: Record<ZoneType, { friction: number; restitution: number; rollingResistance: number }> = {
  tee:     { friction: 0.5, restitution: 0.4,  rollingResistance: 0.08 },
  fairway: { friction: 0.5, restitution: 0.4,  rollingResistance: 0.10 },
  green:   { friction: 0.4, restitution: 0.3,  rollingResistance: 0.06 },
  rough:   { friction: 0.8, restitution: 0.2,  rollingResistance: 0.25 },
  sand:    { friction: 1.0, restitution: 0.05, rollingResistance: 0.65 },
  water:   { friction: 0.3, restitution: 0.0,  rollingResistance: 0.10 },
};

export const ZONE_COLORS: Record<ZoneType, number> = {
  tee: 0x4a8c3f,
  fairway: 0x5da84e,
  green: 0x6ec85e,
  rough: 0x3d7a32,
  sand: 0xe8d68c,
  water: 0x3a8fbf,
};

export interface ClubData {
  name: string;
  loftAngle: number;   // radians
  maxSpeed: number;     // m/s — determines max distance
  powerSpeed: number;   // power meter oscillation rate
}

export const CLUBS: ClubData[] = [
  { name: 'Driver',  loftAngle: (10 * Math.PI) / 180, maxSpeed: 60, powerSpeed: 1.5 },
  { name: '3 Wood',  loftAngle: (15 * Math.PI) / 180, maxSpeed: 45, powerSpeed: 1.5 },
  { name: '5 Iron',  loftAngle: (24 * Math.PI) / 180, maxSpeed: 35, powerSpeed: 1.4 },
  { name: '7 Iron',  loftAngle: (30 * Math.PI) / 180, maxSpeed: 30, powerSpeed: 1.4 },
  { name: '9 Iron',  loftAngle: (38 * Math.PI) / 180, maxSpeed: 24, powerSpeed: 1.3 },
  { name: 'PW',      loftAngle: (45 * Math.PI) / 180, maxSpeed: 20, powerSpeed: 1.2 },
  { name: 'SW',      loftAngle: (56 * Math.PI) / 180, maxSpeed: 17, powerSpeed: 1.1 },
  { name: 'Putter',  loftAngle: (3  * Math.PI) / 180, maxSpeed: 10, powerSpeed: 0.7 },
];

export const DEFAULT_CLUB_INDEX = 3; // 7 Iron

export const BALL_RADIUS = 0.15;
export const BALL_MASS = 0.046;
export const SLEEP_SPEED_THRESHOLD = 0.05;
export const SLEEP_TIME_THRESHOLD = 0.5;
export const HOLE_CUP_RADIUS = 0.3;
export const HOLE_DETECTION_SPEED = 1.0;
