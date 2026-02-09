import { ZoneType, ZONE_COLORS } from '../types';

interface MinimapZone {
  type: ZoneType;
  shape: 'rect' | 'circle';
  position: { x: number; z: number };
  size?: { width: number; height: number };
  radius?: number;
}

const SIZE = 180;
const PADDING = 10;

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private zones: MinimapZone[] = [];
  private teePos = { x: 0, z: 0 };
  private holePos = { x: 0, z: 0 };
  private bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
  private time = 0;
  private zoneColors: Record<ZoneType, number> = { ...ZONE_COLORS };

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.className = 'minimap-canvas';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  setZoneColors(colors: Record<ZoneType, number>) {
    this.zoneColors = colors;
  }

  setCourse(
    zones: MinimapZone[],
    tee: { x: number; z: number },
    hole: { x: number; z: number }
  ) {
    this.zones = zones;
    this.teePos = tee;
    this.holePos = hole;
    this.computeBounds();
  }

  private computeBounds() {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const z of this.zones) {
      if (z.shape === 'rect' && z.size) {
        minX = Math.min(minX, z.position.x - z.size.width / 2);
        maxX = Math.max(maxX, z.position.x + z.size.width / 2);
        minZ = Math.min(minZ, z.position.z - z.size.height / 2);
        maxZ = Math.max(maxZ, z.position.z + z.size.height / 2);
      } else if (z.shape === 'circle' && z.radius) {
        minX = Math.min(minX, z.position.x - z.radius);
        maxX = Math.max(maxX, z.position.x + z.radius);
        minZ = Math.min(minZ, z.position.z - z.radius);
        maxZ = Math.max(maxZ, z.position.z + z.radius);
      }
    }

    // Include tee and hole
    minX = Math.min(minX, this.teePos.x, this.holePos.x) - 5;
    maxX = Math.max(maxX, this.teePos.x, this.holePos.x) + 5;
    minZ = Math.min(minZ, this.teePos.z, this.holePos.z) - 5;
    maxZ = Math.max(maxZ, this.teePos.z, this.holePos.z) + 5;

    this.bounds = { minX, maxX, minZ, maxZ };
  }

  private worldToMinimap(wx: number, wz: number): { x: number; y: number } {
    const rangeX = this.bounds.maxX - this.bounds.minX;
    const rangeZ = this.bounds.maxZ - this.bounds.minZ;
    const scale = Math.max(rangeX, rangeZ);
    const drawSize = SIZE - PADDING * 2;

    const x = PADDING + ((wx - this.bounds.minX) / scale) * drawSize;
    // Flip Z so that negative Z (forward in game) is up on minimap
    const y = PADDING + ((this.bounds.maxZ - wz) / scale) * drawSize;
    return { x, y };
  }

  private worldSizeToMinimap(size: number): number {
    const rangeX = this.bounds.maxX - this.bounds.minX;
    const rangeZ = this.bounds.maxZ - this.bounds.minZ;
    const scale = Math.max(rangeX, rangeZ);
    const drawSize = SIZE - PADDING * 2;
    return (size / scale) * drawSize;
  }

  private hexToCSS(hex: number): string {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  update(ballPos: { x: number; z: number }) {
    this.time += 0.016;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 8);
    ctx.fill();

    // Draw zones
    for (const zone of this.zones) {
      ctx.fillStyle = this.hexToCSS(this.zoneColors[zone.type] ?? 0x3d7a32);
      ctx.globalAlpha = 0.8;

      if (zone.shape === 'rect' && zone.size) {
        const tl = this.worldToMinimap(
          zone.position.x - zone.size.width / 2,
          zone.position.z + zone.size.height / 2
        );
        const w = this.worldSizeToMinimap(zone.size.width);
        const h = this.worldSizeToMinimap(zone.size.height);
        ctx.fillRect(tl.x, tl.y, w, h);
      } else if (zone.shape === 'circle' && zone.radius) {
        const center = this.worldToMinimap(zone.position.x, zone.position.z);
        const r = this.worldSizeToMinimap(zone.radius);
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Tee marker (white square)
    const tee = this.worldToMinimap(this.teePos.x, this.teePos.z);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tee.x - 3, tee.y - 3, 6, 6);

    // Hole marker (red dot, pulsing)
    const hole = this.worldToMinimap(this.holePos.x, this.holePos.z);
    const pulseR = 4 + Math.sin(this.time * 4) * 1.5;
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, pulseR, 0, Math.PI * 2);
    ctx.fill();

    // Ball marker (white dot, animated)
    const ball = this.worldToMinimap(ballPos.x, ballPos.z);
    const ballR = 3 + Math.sin(this.time * 6) * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballR, 0, Math.PI * 2);
    ctx.fill();

    // Ball glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballR + 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  dispose() {
    this.canvas.remove();
  }
}
