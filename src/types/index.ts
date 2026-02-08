export type ZoneType = 'tee' | 'fairway' | 'green' | 'rough' | 'sand' | 'water' | 'ice' | 'snow';

export type GameState = 'aiming' | 'power' | 'rolling' | 'stopped' | 'holed';

export type CourseTheme = 'meadow' | 'desert' | 'arctic';

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SponsorData {
  name: string;
  tagline?: string;
  primaryColor: string;   // hex color e.g. "#ff0000"
  secondaryColor?: string;
  website?: string;
  tier: 'hole' | 'course' | 'designer';  // sponsorship level
}

export interface ZoneData {
  type: ZoneType;
  shape: 'rect' | 'circle';
  position: Vec2;
  size?: { width: number; height: number };
  radius?: number;
}

export interface ObstacleData {
  type: 'tree' | 'rock' | 'cactus' | 'ice_rock' | 'snow_tree';
  position: Vec3;
}

export interface GreenData {
  slopeAngle: number;      // degrees — direction the ball breaks toward (0=+x, 90=+z, 180=-x, 270=-z)
  slopeStrength: number;   // 0-1 scale — how much force the slope exerts
  speed: 'slow' | 'medium' | 'fast'; // stimp rating category
}

export interface CourseData {
  name: string;
  par: number;
  tee: Vec2;
  hole: Vec2;
  zones: ZoneData[];
  obstacles: ObstacleData[];
  theme?: CourseTheme;
  sponsor?: SponsorData;
  green?: GreenData;
}

export const GREEN_SPEED_FACTOR: Record<string, number> = {
  slow: 0.08,
  medium: 0.06,
  fast: 0.04,
};

export interface ThemeConfig {
  skyColor: number;
  fogColor: number;
  groundColor: number;
  zoneColors: Record<ZoneType, number>;
  ambientIntensity: number;
  sunIntensity: number;
  sunColor: number;
}

export const ZONE_PHYSICS: Record<ZoneType, { friction: number; restitution: number; rollingResistance: number }> = {
  tee:     { friction: 0.5, restitution: 0.4,  rollingResistance: 0.08 },
  fairway: { friction: 0.5, restitution: 0.4,  rollingResistance: 0.10 },
  green:   { friction: 0.4, restitution: 0.3,  rollingResistance: 0.06 },
  rough:   { friction: 0.8, restitution: 0.2,  rollingResistance: 0.25 },
  sand:    { friction: 1.0, restitution: 0.05, rollingResistance: 0.65 },
  water:   { friction: 0.3, restitution: 0.0,  rollingResistance: 0.10 },
  ice:     { friction: 0.15, restitution: 0.5, rollingResistance: 0.02 },
  snow:    { friction: 0.7, restitution: 0.1,  rollingResistance: 0.35 },
};

export const ZONE_COLORS: Record<ZoneType, number> = {
  tee: 0x4a8c3f,
  fairway: 0x5da84e,
  green: 0x6ec85e,
  rough: 0x3d7a32,
  sand: 0xe8d68c,
  water: 0x3a8fbf,
  ice: 0xa8d8ea,
  snow: 0xe8e8f0,
};

export const THEME_CONFIGS: Record<CourseTheme, ThemeConfig> = {
  meadow: {
    skyColor: 0x87ceeb,
    fogColor: 0x87ceeb,
    groundColor: 0x3d7a32,
    zoneColors: { ...ZONE_COLORS },
    ambientIntensity: 0.3,
    sunIntensity: 1.0,
    sunColor: 0xffffff,
  },
  desert: {
    skyColor: 0xf4a460,
    fogColor: 0xe8c88a,
    groundColor: 0xc2a355,
    zoneColors: {
      tee: 0x8b7d3c,
      fairway: 0xa09040,
      green: 0x6e9b3e,
      rough: 0xc2a355,
      sand: 0xe8d68c,
      water: 0x2e8b8b,
      ice: 0xa8d8ea,
      snow: 0xe8e8f0,
    },
    ambientIntensity: 0.5,
    sunIntensity: 1.4,
    sunColor: 0xfff4e0,
  },
  arctic: {
    skyColor: 0xb0c4de,
    fogColor: 0xc8d8e8,
    groundColor: 0xd0d8e0,
    zoneColors: {
      tee: 0x6b8e6b,
      fairway: 0x7aa87a,
      green: 0x8ec88e,
      rough: 0xd0d8e0,
      sand: 0xc8c8d0,
      water: 0x4a7a9b,
      ice: 0xa8d8ea,
      snow: 0xe8e8f0,
    },
    ambientIntensity: 0.4,
    sunIntensity: 0.8,
    sunColor: 0xe8e8ff,
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

export const BALL_RADIUS = 0.15;
export const BALL_MASS = 0.046;
export const SLEEP_SPEED_THRESHOLD = 0.05;
export const SLEEP_TIME_THRESHOLD = 0.5;
export const HOLE_CUP_RADIUS = 0.3;
export const HOLE_DETECTION_SPEED = 1.0;
