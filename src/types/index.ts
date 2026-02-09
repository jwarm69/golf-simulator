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
  theme?: string;
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

export type ThemeName = 'meadow' | 'lakeside' | 'forest' | 'desert' | 'arctic' | 'volcanic' | 'tropical' | 'canyon' | 'moonscape';

export interface ThemeColors {
  zones: Record<ZoneType, number>;
  fog: number;
}

export const THEME_COLORS: Record<ThemeName, ThemeColors> = {
  meadow: {
    zones: { tee: 0x4a8c3f, fairway: 0x5da84e, green: 0x6ec85e, rough: 0x3d7a32, sand: 0xe8d68c, water: 0x3a8fbf },
    fog: 0xb0d4e8,
  },
  lakeside: {
    zones: { tee: 0x4a8c3f, fairway: 0x5da84e, green: 0x6ec85e, rough: 0x3d7a32, sand: 0xe8d68c, water: 0x3a8fbf },
    fog: 0xb0d4e8,
  },
  forest: {
    zones: { tee: 0x3a6e30, fairway: 0x4a8a3e, green: 0x5ab84e, rough: 0x2d5a22, sand: 0xd8c67c, water: 0x2a7faf },
    fog: 0x8ab8a8,
  },
  desert: {
    zones: { tee: 0xb8a060, fairway: 0xc4a868, green: 0x7aaa50, rough: 0xa89050, sand: 0xd4b878, water: 0x4a9abf },
    fog: 0xe0c890,
  },
  arctic: {
    zones: { tee: 0xd0e0e8, fairway: 0xe0e8f0, green: 0xc0e8c0, rough: 0xc0d0d8, sand: 0xf0f0f0, water: 0x80b8d8 },
    fog: 0xe8f0f8,
  },
  volcanic: {
    zones: { tee: 0x505050, fairway: 0x606060, green: 0x4a8a3a, rough: 0x3a3a3a, sand: 0x808080, water: 0xcc4400 },
    fog: 0x804020,
  },
  tropical: {
    zones: { tee: 0x40a040, fairway: 0x50b850, green: 0x60d060, rough: 0x308830, sand: 0xf0c890, water: 0x40c0c0 },
    fog: 0xa0d8e0,
  },
  canyon: {
    zones: { tee: 0xa06040, fairway: 0xb07050, green: 0x70a050, rough: 0x905838, sand: 0xc08060, water: 0x3080a0 },
    fog: 0xc0a080,
  },
  moonscape: {
    zones: { tee: 0x808080, fairway: 0x909090, green: 0x70a870, rough: 0x606060, sand: 0xa0a0a0, water: 0x304060 },
    fog: 0x505060,
  },
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

export const AUTO_PUTTER_DISTANCE = 30;

export const GRAVITY = 9.82;
export const MS_TO_MPH = 2.237;

export const BALL_RADIUS = 0.15;
export const BALL_MASS = 0.046;
export const SLEEP_SPEED_THRESHOLD = 0.05;
export const SLEEP_TIME_THRESHOLD = 0.5;
export const HOLE_CUP_RADIUS = 0.3;
export const HOLE_DETECTION_SPEED = 1.0;
