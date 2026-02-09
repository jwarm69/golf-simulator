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

    // Add sponsor sign near the tee
    this.addSponsorSign(course.tee.x, course.tee.z);

    // Add a fun themed 3D object
    this.addThemedObject(course);
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

  private addSponsorSign(teeX: number, teeZ: number) {
    const group = new THREE.Group();

    // Two posts
    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.6 });
    const postL = new THREE.Mesh(postGeo, postMat);
    postL.position.set(-1.1, 1.1, 0);
    postL.castShadow = true;
    group.add(postL);
    const postR = new THREE.Mesh(postGeo, postMat);
    postR.position.set(1.1, 1.1, 0);
    postR.castShadow = true;
    group.add(postR);

    // Sign board via canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.roundRect(0, 0, 512, 192, 12);
    ctx.fill();

    // Gold border
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, 180, 8);
    ctx.stroke();

    // "This hole is sponsored by" text
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 30px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('This hole is sponsored by', 256, 60);

    // Blank sponsor area (dashed underline)
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(100, 140);
    ctx.lineTo(412, 140);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    const signGeo = new THREE.PlaneGeometry(2.4, 0.9);
    const signMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.4,
      metalness: 0.1,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.y = 1.8;
    sign.castShadow = true;
    group.add(sign);

    // Also render the back side
    const backSign = new THREE.Mesh(signGeo, signMat);
    backSign.position.y = 1.8;
    backSign.rotation.y = Math.PI;
    group.add(backSign);

    // Position the sign to the right of the tee, facing sideways
    group.position.set(teeX + 4, 0, teeZ);
    group.rotation.y = Math.PI / 2;

    this.scene.add(group);
    // Track sub-meshes for cleanup
    for (const child of group.children) {
      this.meshes.push(child as THREE.Mesh);
    }
  }

  private addThemedObject(course: CourseData) {
    const theme = course.theme ?? 'meadow';
    // Place the object roughly midway between tee and hole, offset to the side
    const midX = (course.tee.x + course.hole.x) / 2;
    const midZ = (course.tee.z + course.hole.z) / 2;
    // Offset to the right side so it doesn't block play
    const ox = midX + 12;
    const oz = midZ;

    switch (theme) {
      case 'meadow':
      default:
        this.buildWindmill(ox, oz);
        break;
      case 'lakeside':
        this.buildDock(ox, oz);
        break;
      case 'forest':
        this.buildCabin(ox, oz);
        break;
      case 'desert':
        this.buildPyramid(ox, oz);
        break;
      case 'arctic':
        this.buildSnowman(ox, oz);
        break;
      case 'volcanic':
        this.buildVolcano(ox, oz);
        break;
      case 'tropical':
        this.buildTikiStatue(ox, oz);
        break;
      case 'canyon':
        this.buildStoneArch(ox, oz);
        break;
      case 'moonscape':
        this.buildRocket(ox, oz);
        break;
    }
  }

  private addMesh(mesh: THREE.Mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
  }

  private buildWindmill(x: number, z: number) {
    // Tower
    const towerGeo = new THREE.CylinderGeometry(0.8, 1.2, 5, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.9 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(x, 2.5, z);
    this.addMesh(tower);

    // Roof (cone)
    const roofGeo = new THREE.ConeGeometry(1.0, 1.5, 8);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(x, 5.75, z);
    this.addMesh(roof);

    // Blades (4 flat boxes as vanes)
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdec89a, roughness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const bladeGeo = new THREE.BoxGeometry(0.3, 2.5, 0.05);
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      const angle = (i * Math.PI) / 2;
      blade.position.set(
        x + Math.cos(angle) * 1.25,
        4.5 + Math.sin(angle) * 1.25,
        z - 1.0
      );
      blade.rotation.z = angle;
      this.addMesh(blade);
    }

    // Door
    const doorGeo = new THREE.PlaneGeometry(0.6, 1.0);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(x, 0.5, z - 1.21);
    this.addMesh(door);
  }

  private buildDock(x: number, z: number) {
    // Wooden planks platform
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.85 });
    const deckGeo = new THREE.BoxGeometry(3, 0.15, 5);
    const deck = new THREE.Mesh(deckGeo, plankMat);
    deck.position.set(x, 0.4, z);
    this.addMesh(deck);

    // Support posts
    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4e1e, roughness: 0.9 });
    const postPositions = [[-1.2, -2], [1.2, -2], [-1.2, 2], [1.2, 2]];
    for (const [px, pz] of postPositions) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x + px, 0, z + pz);
      this.addMesh(post);
    }

    // Bollard with rope suggestion
    const bollardGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.6, 8);
    const bollardMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.3 });
    const bollard = new THREE.Mesh(bollardGeo, bollardMat);
    bollard.position.set(x + 1.3, 0.78, z - 2.2);
    this.addMesh(bollard);

    // Small rowboat next to dock
    const boatGeo = new THREE.CapsuleGeometry(0.4, 1.8, 4, 8);
    const boatMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.7 });
    const boat = new THREE.Mesh(boatGeo, boatMat);
    boat.position.set(x + 2.5, 0.15, z);
    boat.rotation.z = Math.PI / 2;
    boat.scale.set(0.7, 0.5, 1);
    this.addMesh(boat);
  }

  private buildCabin(x: number, z: number) {
    // Cabin body
    const bodyGeo = new THREE.BoxGeometry(3, 2, 3);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6b3a1e, roughness: 0.9 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(x, 1, z);
    this.addMesh(body);

    // Roof
    const roofGeo = new THREE.ConeGeometry(2.6, 1.5, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a2a0e, roughness: 0.8 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(x, 2.75, z);
    roof.rotation.y = Math.PI / 4;
    this.addMesh(roof);

    // Door
    const doorGeo = new THREE.PlaneGeometry(0.7, 1.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a1a0a, roughness: 0.9 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(x, 0.6, z - 1.51);
    this.addMesh(door);

    // Chimney
    const chimGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
    const chimMat = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9 });
    const chimney = new THREE.Mesh(chimGeo, chimMat);
    chimney.position.set(x + 0.8, 3.1, z + 0.5);
    this.addMesh(chimney);
  }

  private buildPyramid(x: number, z: number) {
    // Main pyramid
    const pyrGeo = new THREE.ConeGeometry(3, 5, 4);
    const pyrMat = new THREE.MeshStandardMaterial({ color: 0xdcb060, roughness: 0.8 });
    const pyramid = new THREE.Mesh(pyrGeo, pyrMat);
    pyramid.position.set(x, 2.5, z);
    pyramid.rotation.y = Math.PI / 4;
    this.addMesh(pyramid);

    // Small secondary pyramid
    const pyr2Geo = new THREE.ConeGeometry(1.5, 2.5, 4);
    const pyr2 = new THREE.Mesh(pyr2Geo, pyrMat);
    pyr2.position.set(x - 4, 1.25, z + 2);
    pyr2.rotation.y = Math.PI / 4;
    this.addMesh(pyr2);

    // Entrance (dark rectangle on pyramid face)
    const entrGeo = new THREE.PlaneGeometry(0.8, 1.2);
    const entrMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 1.0 });
    const entrance = new THREE.Mesh(entrGeo, entrMat);
    entrance.position.set(x, 0.6, z - 2.4);
    entrance.rotation.x = -0.25;
    this.addMesh(entrance);
  }

  private buildSnowman(x: number, z: number) {
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8f8ff, roughness: 0.6 });

    // Bottom sphere
    const botGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const bottom = new THREE.Mesh(botGeo, snowMat);
    bottom.position.set(x, 1.2, z);
    this.addMesh(bottom);

    // Middle sphere
    const midGeo = new THREE.SphereGeometry(0.9, 16, 16);
    const middle = new THREE.Mesh(midGeo, snowMat);
    middle.position.set(x, 3.0, z);
    this.addMesh(middle);

    // Head
    const headGeo = new THREE.SphereGeometry(0.6, 16, 16);
    const head = new THREE.Mesh(headGeo, snowMat);
    head.position.set(x, 4.2, z);
    this.addMesh(head);

    // Top hat
    const brimGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.08, 12);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
    const brim = new THREE.Mesh(brimGeo, hatMat);
    brim.position.set(x, 4.75, z);
    this.addMesh(brim);

    const crownGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.7, 12);
    const crown = new THREE.Mesh(crownGeo, hatMat);
    crown.position.set(x, 5.15, z);
    this.addMesh(crown);

    // Carrot nose
    const noseGeo = new THREE.ConeGeometry(0.1, 0.5, 8);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.7 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(x, 4.2, z - 0.65);
    nose.rotation.x = -Math.PI / 2;
    this.addMesh(nose);

    // Eyes (coal)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(x - 0.2, 4.35, z - 0.55);
    this.addMesh(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(x + 0.2, 4.35, z - 0.55);
    this.addMesh(eyeR);

    // Stick arms
    const armMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6);
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(x - 1.2, 3.2, z);
    armL.rotation.z = Math.PI / 3;
    this.addMesh(armL);
    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(x + 1.2, 3.2, z);
    armR.rotation.z = -Math.PI / 3;
    this.addMesh(armR);
  }

  private buildVolcano(x: number, z: number) {
    // Main cone
    const coneGeo = new THREE.CylinderGeometry(1.0, 4.0, 6, 12);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(x, 3, z);
    this.addMesh(cone);

    // Crater rim (torus on top)
    const rimGeo = new THREE.TorusGeometry(1.0, 0.3, 8, 16);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.8 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(x, 6.0, z);
    rim.rotation.x = Math.PI / 2;
    this.addMesh(rim);

    // Lava pool in crater
    const lavaGeo = new THREE.CircleGeometry(0.8, 16);
    const lavaMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff2200,
      emissiveIntensity: 0.8,
      roughness: 0.3,
    });
    const lava = new THREE.Mesh(lavaGeo, lavaMat);
    lava.position.set(x, 6.05, z);
    lava.rotation.x = -Math.PI / 2;
    this.addMesh(lava);

    // Lava streaks down the side
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3 + 0.3;
      const streakGeo = new THREE.PlaneGeometry(0.3, 3);
      const streakMat = new THREE.MeshStandardMaterial({
        color: 0xff3300,
        emissive: 0xcc2200,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const streak = new THREE.Mesh(streakGeo, streakMat);
      streak.position.set(
        x + Math.cos(angle) * 2.0,
        3.0,
        z + Math.sin(angle) * 2.0
      );
      streak.rotation.y = -angle;
      streak.rotation.x = 0.4;
      this.addMesh(streak);
    }
  }

  private buildTikiStatue(x: number, z: number) {
    // Body/post
    const bodyGeo = new THREE.CylinderGeometry(0.6, 0.7, 3.5, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(x, 1.75, z);
    this.addMesh(body);

    // Head (wider)
    const headGeo = new THREE.CylinderGeometry(0.75, 0.6, 1.5, 8);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(x, 4.25, z);
    this.addMesh(head);

    // Eyes (glowing green)
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00cc44,
      emissiveIntensity: 0.6,
    });
    const eyeGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(x - 0.3, 4.4, z - 0.65);
    this.addMesh(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(x + 0.3, 4.4, z - 0.65);
    this.addMesh(eyeR);

    // Mouth (dark slit)
    const mouthGeo = new THREE.BoxGeometry(0.5, 0.15, 0.1);
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 1.0 });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(x, 3.9, z - 0.72);
    this.addMesh(mouth);

    // Top flame bowl
    const bowlGeo = new THREE.CylinderGeometry(0.5, 0.3, 0.4, 8);
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0x5a3a0a, roughness: 0.8 });
    const bowl = new THREE.Mesh(bowlGeo, bowlMat);
    bowl.position.set(x, 5.2, z);
    this.addMesh(bowl);

    // Flame
    const flameGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff4400,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.85,
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(x, 5.8, z);
    this.addMesh(flame);
  }

  private buildStoneArch(x: number, z: number) {
    const archMat = new THREE.MeshStandardMaterial({ color: 0xb05030, roughness: 0.9 });

    // Left pillar
    const pillarGeo = new THREE.BoxGeometry(1.2, 5, 1.2);
    const pillarL = new THREE.Mesh(pillarGeo, archMat);
    pillarL.position.set(x - 2, 2.5, z);
    this.addMesh(pillarL);

    // Right pillar
    const pillarR = new THREE.Mesh(pillarGeo, archMat);
    pillarR.position.set(x + 2, 2.5, z);
    this.addMesh(pillarR);

    // Arch span (curved using a torus segment)
    const archGeo = new THREE.TorusGeometry(2.0, 0.6, 8, 16, Math.PI);
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.position.set(x, 5.0, z);
    arch.rotation.z = Math.PI;
    this.addMesh(arch);

    // Weathered detail rocks at base
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x904828, roughness: 0.95 });
    for (let i = 0; i < 4; i++) {
      const debrisGeo = new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.2, 0);
      const debris = new THREE.Mesh(debrisGeo, debrisMat);
      debris.position.set(
        x + (Math.random() - 0.5) * 5,
        0.2,
        z + (Math.random() - 0.5) * 2
      );
      this.addMesh(debris);
    }
  }

  private buildRocket(x: number, z: number) {
    // Rocket body
    const bodyGeo = new THREE.CylinderGeometry(0.6, 0.7, 5, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.3, metalness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(x, 2.5, z);
    this.addMesh(body);

    // Nose cone
    const noseGeo = new THREE.ConeGeometry(0.6, 1.5, 12);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.3, metalness: 0.4 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(x, 5.75, z);
    this.addMesh(nose);

    // Window porthole
    const winGeo = new THREE.CircleGeometry(0.18, 12);
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      emissive: 0x4488cc,
      emissiveIntensity: 0.3,
      metalness: 0.6,
    });
    const window1 = new THREE.Mesh(winGeo, winMat);
    window1.position.set(x, 4.0, z - 0.71);
    this.addMesh(window1);
    const window2 = new THREE.Mesh(winGeo, winMat);
    window2.position.set(x, 3.2, z - 0.71);
    this.addMesh(window2);

    // Fins (3 around the base)
    const finMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.4, metalness: 0.3 });
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const finGeo = new THREE.BoxGeometry(0.1, 1.5, 1.0);
      const fin = new THREE.Mesh(finGeo, finMat);
      fin.position.set(
        x + Math.sin(angle) * 0.8,
        0.75,
        z + Math.cos(angle) * 0.8
      );
      fin.rotation.y = -angle;
      this.addMesh(fin);
    }

    // Exhaust glow at base
    const exhaustGeo = new THREE.ConeGeometry(0.5, 1.2, 8);
    const exhaustMat = new THREE.MeshStandardMaterial({
      color: 0xff8800,
      emissive: 0xff6600,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.7,
    });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.set(x, -0.4, z);
    exhaust.rotation.x = Math.PI;
    this.addMesh(exhaust);
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
