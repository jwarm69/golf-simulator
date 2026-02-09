import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../core/PhysicsWorld';
import { CourseData, ZoneData, ObstacleData, ZoneType, ZONE_COLORS } from '../types';

interface ZoneBounds {
  type: ZoneType;
  shape: 'rect' | 'circle';
  position: { x: number; z: number };
  size?: { width: number; height: number };
  radius?: number;
}

const WATER_VERTEX_SHADER = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWaveHeight;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vec3 pos = position;

    // Multi-octave wave displacement
    float wave1 = sin(pos.x * 3.0 + uTime * 2.0) * 0.08;
    float wave2 = sin(pos.y * 4.0 + uTime * 1.5) * 0.06;
    float wave3 = sin((pos.x + pos.y) * 2.0 + uTime * 3.0) * 0.04;
    float wave4 = sin(pos.x * 8.0 + pos.y * 6.0 + uTime * 4.5) * 0.02;
    float wave5 = sin(pos.x * 12.0 - pos.y * 10.0 + uTime * 5.0) * 0.01;
    float wave = wave1 + wave2 + wave3 + wave4 + wave5;
    pos.z += wave;
    vWaveHeight = wave;

    // Compute tangent-space normal from wave derivatives
    float dx = cos(pos.x * 3.0 + uTime * 2.0) * 3.0 * 0.08
             + cos((pos.x + pos.y) * 2.0 + uTime * 3.0) * 2.0 * 0.04
             + cos(pos.x * 8.0 + pos.y * 6.0 + uTime * 4.5) * 8.0 * 0.02
             + cos(pos.x * 12.0 - pos.y * 10.0 + uTime * 5.0) * 12.0 * 0.01;
    float dy = cos(pos.y * 4.0 + uTime * 1.5) * 4.0 * 0.06
             + cos((pos.x + pos.y) * 2.0 + uTime * 3.0) * 2.0 * 0.04
             + cos(pos.x * 8.0 + pos.y * 6.0 + uTime * 4.5) * 6.0 * 0.02
             - cos(pos.x * 12.0 - pos.y * 10.0 + uTime * 5.0) * 10.0 * 0.01;
    vNormal = normalize(vec3(-dx, -dy, 1.0));

    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const WATER_FRAGMENT_SHADER = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWaveHeight;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec3 deepBlue = vec3(0.08, 0.22, 0.42);
    vec3 midBlue = vec3(0.15, 0.38, 0.60);
    vec3 lightBlue = vec3(0.35, 0.65, 0.90);
    vec3 foamWhite = vec3(0.85, 0.92, 0.98);

    // Color gradient based on wave height
    float t = smoothstep(-0.12, 0.12, vWaveHeight);
    vec3 color = mix(deepBlue, midBlue, t);
    color = mix(color, lightBlue, smoothstep(0.05, 0.15, vWaveHeight));

    // Foam on wave crests
    float foam = smoothstep(0.10, 0.14, vWaveHeight) * 0.4;
    color = mix(color, foamWhite, foam);

    // Fresnel-like edge brightening
    float edge = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 0.3) * pow(1.0 - abs(vUv.y - 0.5) * 2.0, 0.3);
    color += vec3(0.08, 0.12, 0.18) * (1.0 - edge);

    // Caustic-like shimmer pattern
    float shimmer1 = sin(vUv.x * 30.0 + uTime * 4.0) * sin(vUv.y * 30.0 + uTime * 3.0);
    float shimmer2 = sin(vUv.x * 22.0 - uTime * 2.5) * sin(vUv.y * 18.0 + uTime * 3.5);
    float shimmer = (shimmer1 + shimmer2 * 0.5) * 0.04;
    color += shimmer;

    // Specular highlight approximation
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 lightDir = normalize(vec3(30.0, 50.0, 20.0));
    vec3 halfDir = normalize(viewDir + lightDir);
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 64.0);
    color += vec3(1.0, 0.95, 0.85) * spec * 0.6;

    gl_FragColor = vec4(color, 0.78);
  }
`;

/** Generate a procedural grass normal map on a canvas */
function createGrassNormalMap(resolution: number, bladeScale: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(resolution, resolution);
  const data = imageData.data;

  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const i = (y * resolution + x) * 4;
      const u = x / resolution;
      const v = y / resolution;

      // Procedural blade-like bumps
      const blade1 = Math.sin(u * bladeScale) * Math.cos(v * bladeScale * 0.7);
      const blade2 = Math.sin(u * bladeScale * 1.3 + 1.7) * Math.cos(v * bladeScale * 0.5 + 2.3);
      const blade3 = Math.sin(u * bladeScale * 2.1 + 3.1) * Math.cos(v * bladeScale * 1.8 + 0.5);

      // Compute normal from height derivatives
      const nx = (blade1 * 0.4 + blade2 * 0.3 + blade3 * 0.15);
      const ny = (blade1 * 0.3 + blade2 * 0.4 + blade3 * 0.2);

      // Encode as RGB (tangent-space normal map: R=x, G=y, B=z)
      data[i]     = Math.floor((nx * 0.5 + 0.5) * 255); // R
      data[i + 1] = Math.floor((ny * 0.5 + 0.5) * 255); // G
      data[i + 2] = Math.floor(0.85 * 255);              // B (mostly pointing up)
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

/** Generate a procedural grass color texture */
function createGrassTexture(resolution: number, baseColor: number, variation: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(resolution, resolution);
  const data = imageData.data;

  const r = ((baseColor >> 16) & 0xff) / 255;
  const g = ((baseColor >> 8) & 0xff) / 255;
  const b = (baseColor & 0xff) / 255;

  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const i = (y * resolution + x) * 4;
      const u = x / resolution;
      const v = y / resolution;

      // Blade pattern for color variation
      const blade = Math.sin(u * 60) * 0.5 + 0.5;
      const noise = (Math.sin(u * 123.45 + v * 67.89) * 43758.5453 % 1);
      const vary = (blade * 0.6 + noise * 0.4) * variation;

      data[i]     = Math.min(255, Math.floor((r + vary * 0.03) * 255));
      data[i + 1] = Math.min(255, Math.floor((g + vary * 0.06) * 255));
      data[i + 2] = Math.min(255, Math.floor((b + vary * 0.02) * 255));
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

export class Terrain {
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  private meshes: THREE.Mesh[] = [];
  private bodies: CANNON.Body[] = [];
  private zoneBounds: ZoneBounds[] = [];
  private waterMaterials: THREE.ShaderMaterial[] = [];
  private zoneColors: Record<ZoneType, number> = { ...ZONE_COLORS };
  private grassNormalMap: THREE.CanvasTexture;
  private grassTextures: Map<number, THREE.CanvasTexture> = new Map();

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics;
    this.grassNormalMap = createGrassNormalMap(256, 40);
  }

  setZoneColors(colors: Record<ZoneType, number>) {
    this.zoneColors = colors;
  }

  private getGrassTexture(color: number): THREE.CanvasTexture {
    if (!this.grassTextures.has(color)) {
      this.grassTextures.set(color, createGrassTexture(256, color, 1.0));
    }
    return this.grassTextures.get(color)!;
  }

  private createGrassMaterial(color: number, roughness: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      map: this.getGrassTexture(color),
      normalMap: this.grassNormalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness,
    });
  }

  buildFromCourse(course: CourseData) {
    this.clear();
    this.grassTextures.clear();

    // Large base ground plane (rough)
    const baseGeo = new THREE.PlaneGeometry(200, 200);
    const baseMat = this.createGrassMaterial(this.zoneColors.rough, 0.9);
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.rotation.x = -Math.PI / 2;
    baseMesh.position.y = -0.01;
    baseMesh.receiveShadow = true;
    this.scene.add(baseMesh);
    this.meshes.push(baseMesh);

    // Build zones
    for (const zone of course.zones) {
      this.addZone(zone);
    }

    // Build obstacles
    for (const obstacle of course.obstacles) {
      this.addObstacle(obstacle, course.theme);
    }
  }

  private addZone(zone: ZoneData) {
    const color = this.zoneColors[zone.type] ?? this.zoneColors.rough;

    let mesh: THREE.Mesh;

    if (zone.type === 'water') {
      mesh = this.createWaterMesh(zone);
    } else if (zone.shape === 'rect' && zone.size) {
      const geo = new THREE.PlaneGeometry(zone.size.width, zone.size.height);
      const isGrass = zone.type !== 'sand';
      const mat = isGrass
        ? this.createGrassMaterial(color, 0.8)
        : new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.position.x, 0.005, zone.position.z);
    } else if (zone.shape === 'circle' && zone.radius) {
      const geo = new THREE.CircleGeometry(zone.radius, 32);
      const isGrass = zone.type !== 'sand';
      const mat = isGrass
        ? this.createGrassMaterial(color, 0.8)
        : new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.position.x, 0.005, zone.position.z);
    } else {
      return;
    }

    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    this.zoneBounds.push({
      type: zone.type,
      shape: zone.shape,
      position: zone.position,
      size: zone.size,
      radius: zone.radius,
    });
  }

  private createWaterMesh(zone: ZoneData): THREE.Mesh {
    const waterMat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.waterMaterials.push(waterMat);

    let mesh: THREE.Mesh;
    if (zone.shape === 'rect' && zone.size) {
      const geo = new THREE.PlaneGeometry(zone.size.width, zone.size.height, 32, 32);
      mesh = new THREE.Mesh(geo, waterMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.position.x, 0.01, zone.position.z);
    } else if (zone.shape === 'circle' && zone.radius) {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(zone.radius * 2, zone.radius * 2, 32, 32),
        waterMat
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.position.x, 0.01, zone.position.z);
    } else {
      const geo = new THREE.PlaneGeometry(4, 4, 32, 32);
      mesh = new THREE.Mesh(geo, waterMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.position.x, 0.01, zone.position.z);
    }

    return mesh;
  }

  updateWaterTime(time: number) {
    for (const mat of this.waterMaterials) {
      mat.uniforms.uTime.value = time;
    }
  }

  private addObstacle(obstacle: ObstacleData, theme?: string) {
    if (obstacle.type === 'tree') {
      this.addTree(obstacle.position, theme);
    } else if (obstacle.type === 'rock') {
      this.addRock(obstacle.position, theme);
    }
  }

  private addTree(pos: { x: number; y: number; z: number }, theme?: string) {
    let trunkColor = 0x8b4513;
    let foliageColor = 0x2d5a1e;
    let trunkRadiusTop = 0.15;
    let trunkRadiusBottom = 0.2;
    let trunkHeight = 2;
    let foliageType: 'cone' | 'sphere' = 'cone';
    let foliageRadius = 1.5;
    let foliageHeight = 3;
    let foliageY = 3.5;
    let numFoliageLayers = 1;

    switch (theme) {
      case 'desert':
        trunkColor = 0x2d6b2d;
        trunkRadiusTop = 0.2;
        trunkRadiusBottom = 0.25;
        trunkHeight = 3;
        foliageType = 'sphere';
        foliageRadius = 0.4;
        foliageY = 3.7;
        foliageColor = 0x3d8b3d;
        break;
      case 'arctic':
        foliageColor = 0xe8e8f0;
        numFoliageLayers = 2;
        break;
      case 'volcanic':
        trunkColor = 0x2a1a0a;
        foliageColor = 0x1a1a1a;
        break;
      case 'tropical':
        trunkRadiusTop = 0.1;
        trunkRadiusBottom = 0.15;
        trunkHeight = 3.5;
        foliageType = 'sphere';
        foliageRadius = 1.2;
        foliageY = 4.5;
        foliageColor = 0x1d8a1d;
        numFoliageLayers = 2;
        break;
      case 'canyon':
        trunkHeight = 1;
        foliageType = 'sphere';
        foliageRadius = 0.8;
        foliageY = 1.6;
        foliageColor = 0x6b8b3d;
        trunkColor = 0x6b4513;
        break;
      default:
        numFoliageLayers = 2;
        break;
    }

    // Trunk with higher segment count
    const trunkGeo = new THREE.CylinderGeometry(trunkRadiusTop, trunkRadiusBottom, trunkHeight, 12);
    const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(pos.x, trunkHeight / 2, pos.z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    this.scene.add(trunk);
    this.meshes.push(trunk);

    // Foliage layers
    for (let layer = 0; layer < numFoliageLayers; layer++) {
      const layerScale = 1 - layer * 0.3;
      const layerY = foliageY + layer * foliageHeight * 0.5;
      let geo: THREE.BufferGeometry;

      if (foliageType === 'cone') {
        geo = new THREE.ConeGeometry(foliageRadius * layerScale, foliageHeight * layerScale, 12);
      } else {
        geo = new THREE.SphereGeometry(foliageRadius * layerScale, 12, 12);
      }

      const shade = layer * 0.08;
      const fr = Math.min(255, ((foliageColor >> 16) & 0xff) + shade * 255);
      const fg = Math.min(255, ((foliageColor >> 8) & 0xff) + shade * 255);
      const fb = Math.min(255, (foliageColor & 0xff) + shade * 255);
      const layerColor = (Math.floor(fr) << 16) | (Math.floor(fg) << 8) | Math.floor(fb);

      const foliageMat = new THREE.MeshStandardMaterial({ color: layerColor, roughness: 0.75 });
      const foliage = new THREE.Mesh(geo, foliageMat);
      foliage.position.set(pos.x, layerY, pos.z);
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      this.scene.add(foliage);
      this.meshes.push(foliage);
    }

    // Physics body (simple cylinder)
    const treeBody = new CANNON.Body({ mass: 0 });
    treeBody.addShape(new CANNON.Cylinder(0.3, 0.3, 4, 8));
    treeBody.position.set(pos.x, 2, pos.z);
    this.physics.addBody(treeBody);
    this.bodies.push(treeBody);
  }

  private addRock(pos: { x: number; y: number; z: number }, theme?: string) {
    let rockColor = 0x888888;

    switch (theme) {
      case 'desert':
        rockColor = 0xc4a060;
        break;
      case 'arctic':
        rockColor = 0xa0c8e0;
        break;
      case 'volcanic':
        rockColor = 0x2a2a2a;
        break;
      case 'canyon':
        rockColor = 0xb05030;
        break;
      case 'moonscape':
        rockColor = 0x909090;
        break;
    }

    // Higher detail rock geometry
    const rockGeo = new THREE.DodecahedronGeometry(0.6, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: rockColor,
      roughness: theme === 'volcanic' ? 0.3 : 0.95,
      metalness: theme === 'volcanic' ? 0.4 : 0,
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(pos.x, 0.4, pos.z);
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.scene.add(rock);
    this.meshes.push(rock);

    const rockBody = new CANNON.Body({ mass: 0 });
    rockBody.addShape(new CANNON.Sphere(0.6));
    rockBody.position.set(pos.x, 0.4, pos.z);
    this.physics.addBody(rockBody);
    this.bodies.push(rockBody);
  }

  getZoneAtPosition(x: number, z: number): ZoneType {
    // Check zones in reverse order (last added = on top)
    for (let i = this.zoneBounds.length - 1; i >= 0; i--) {
      const zb = this.zoneBounds[i];
      if (zb.shape === 'rect' && zb.size) {
        const hw = zb.size.width / 2;
        const hh = zb.size.height / 2;
        if (
          x >= zb.position.x - hw &&
          x <= zb.position.x + hw &&
          z >= zb.position.z - hh &&
          z <= zb.position.z + hh
        ) {
          return zb.type;
        }
      } else if (zb.shape === 'circle' && zb.radius) {
        const dx = x - zb.position.x;
        const dz = z - zb.position.z;
        if (dx * dx + dz * dz <= zb.radius * zb.radius) {
          return zb.type;
        }
      }
    }
    return 'rough';
  }

  getZoneBounds() {
    return this.zoneBounds;
  }

  clear() {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else {
        mat.dispose();
      }
    }
    for (const body of this.bodies) {
      this.physics.removeBody(body);
    }
    this.meshes = [];
    this.bodies = [];
    this.zoneBounds = [];
    this.waterMaterials = [];
  }
}
