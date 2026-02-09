import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../core/PhysicsWorld';
import { CourseData, ZoneData, ObstacleData, ZoneType, ZONE_COLORS, BALL_RADIUS } from '../types';

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
  void main() {
    vUv = uv;
    vec3 pos = position;
    float wave = sin(pos.x * 3.0 + uTime * 2.0) * 0.08
               + sin(pos.y * 4.0 + uTime * 1.5) * 0.06
               + sin((pos.x + pos.y) * 2.0 + uTime * 3.0) * 0.04;
    pos.z += wave;
    vWaveHeight = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const WATER_FRAGMENT_SHADER = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWaveHeight;
  void main() {
    vec3 deepBlue = vec3(0.15, 0.35, 0.55);
    vec3 lightBlue = vec3(0.3, 0.6, 0.85);
    float t = smoothstep(-0.1, 0.1, vWaveHeight);
    vec3 color = mix(deepBlue, lightBlue, t);
    // Fresnel-like edge brightening
    float edge = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 0.3) * pow(1.0 - abs(vUv.y - 0.5) * 2.0, 0.3);
    color += vec3(0.1, 0.15, 0.2) * (1.0 - edge);
    // Subtle shimmer
    float shimmer = sin(vUv.x * 20.0 + uTime * 4.0) * sin(vUv.y * 20.0 + uTime * 3.0) * 0.05;
    color += shimmer;
    gl_FragColor = vec4(color, 0.75);
  }
`;

export class Terrain {
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  private meshes: THREE.Mesh[] = [];
  private bodies: CANNON.Body[] = [];
  private zoneBounds: ZoneBounds[] = [];
  private waterMaterials: THREE.ShaderMaterial[] = [];
  private zoneColors: Record<ZoneType, number> = { ...ZONE_COLORS };

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics;
  }

  setZoneColors(colors: Record<ZoneType, number>) {
    this.zoneColors = colors;
  }

  buildFromCourse(course: CourseData) {
    this.clear();

    // Large base ground plane (rough)
    const baseGeo = new THREE.PlaneGeometry(200, 200);
    const baseMat = new THREE.MeshStandardMaterial({
      color: this.zoneColors.rough,
      roughness: 0.9,
    });
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
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.position.x, 0.005, zone.position.z);
    } else if (zone.shape === 'circle' && zone.radius) {
      const geo = new THREE.CircleGeometry(zone.radius, 32);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
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
      const geo = new THREE.PlaneGeometry(zone.size.width, zone.size.height, 16, 16);
      mesh = new THREE.Mesh(geo, waterMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.position.x, 0.01, zone.position.z);
    } else if (zone.shape === 'circle' && zone.radius) {
      const geo = new THREE.CircleGeometry(zone.radius, 32, 0, Math.PI * 2);
      // Subdivide for wave effect — use a plane and clip via shape
      const planeGeo = new THREE.PlaneGeometry(zone.radius * 2, zone.radius * 2, 16, 16);
      mesh = new THREE.Mesh(planeGeo, waterMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.position.x, 0.01, zone.position.z);
      planeGeo.dispose(); // we'll use the circle approach instead
      // Actually let's use a circle with enough segments
      const circleGeo = new THREE.CircleGeometry(zone.radius, 32);
      // CircleGeometry doesn't have radial segments for displacement, use PlaneGeometry clipped
      mesh.geometry = new THREE.PlaneGeometry(zone.radius * 2, zone.radius * 2, 16, 16);
    } else {
      const geo = new THREE.PlaneGeometry(4, 4, 16, 16);
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
    let foliageGeo: THREE.BufferGeometry = new THREE.ConeGeometry(1.5, 3, 8);
    let foliageY = 3.5;

    switch (theme) {
      case 'desert':
        // Cactus shape: tall narrow cylinder + sphere top
        trunkColor = 0x2d6b2d;
        trunkRadiusTop = 0.2;
        trunkRadiusBottom = 0.25;
        trunkHeight = 3;
        foliageGeo = new THREE.SphereGeometry(0.4, 8, 8);
        foliageY = 3.7;
        foliageColor = 0x3d8b3d;
        break;
      case 'arctic':
        // Snow-covered tree: white foliage
        foliageColor = 0xe8e8f0;
        break;
      case 'volcanic':
        // Charred tree: dark brown/black
        trunkColor = 0x2a1a0a;
        foliageColor = 0x1a1a1a;
        break;
      case 'tropical':
        // Palm tree: tall thin trunk + sphere crown
        trunkRadiusTop = 0.1;
        trunkRadiusBottom = 0.15;
        trunkHeight = 3.5;
        foliageGeo = new THREE.SphereGeometry(1.2, 8, 8);
        foliageY = 4.5;
        foliageColor = 0x1d8a1d;
        break;
      case 'canyon':
        // Sparse desert scrub: short
        trunkHeight = 1;
        foliageGeo = new THREE.SphereGeometry(0.8, 6, 6);
        foliageY = 1.6;
        foliageColor = 0x6b8b3d;
        trunkColor = 0x6b4513;
        break;
    }

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(trunkRadiusTop, trunkRadiusBottom, trunkHeight, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(pos.x, trunkHeight / 2, pos.z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    this.meshes.push(trunk);

    // Foliage
    const foliageMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.8 });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.set(pos.x, foliageY, pos.z);
    foliage.castShadow = true;
    this.scene.add(foliage);
    this.meshes.push(foliage);

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

    const rockGeo = new THREE.DodecahedronGeometry(0.6, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: rockColor,
      roughness: theme === 'volcanic' ? 0.3 : 0.95,
      metalness: theme === 'volcanic' ? 0.4 : 0,
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(pos.x, 0.4, pos.z);
    rock.castShadow = true;
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
