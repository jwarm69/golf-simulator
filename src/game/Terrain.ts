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

export class Terrain {
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  private meshes: THREE.Mesh[] = [];
  private bodies: CANNON.Body[] = [];
  private zoneBounds: ZoneBounds[] = [];

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics;
  }

  buildFromCourse(course: CourseData) {
    this.clear();

    // Large base ground plane (rough)
    const baseGeo = new THREE.PlaneGeometry(200, 200);
    const baseMat = new THREE.MeshStandardMaterial({
      color: ZONE_COLORS.rough,
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
      this.addObstacle(obstacle);
    }
  }

  private addZone(zone: ZoneData) {
    const color = ZONE_COLORS[zone.type] ?? ZONE_COLORS.rough;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });

    let mesh: THREE.Mesh;

    if (zone.shape === 'rect' && zone.size) {
      const geo = new THREE.PlaneGeometry(zone.size.width, zone.size.height);
      mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.position.x, 0.005, zone.position.z);
    } else if (zone.shape === 'circle' && zone.radius) {
      const geo = new THREE.CircleGeometry(zone.radius, 32);
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

  private addObstacle(obstacle: ObstacleData) {
    if (obstacle.type === 'tree') {
      this.addTree(obstacle.position);
    } else if (obstacle.type === 'rock') {
      this.addRock(obstacle.position);
    }
  }

  private addTree(pos: { x: number; y: number; z: number }) {
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 2, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(pos.x, 1, pos.z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    this.meshes.push(trunk);

    // Foliage
    const foliageGeo = new THREE.ConeGeometry(1.5, 3, 8);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.8 });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.set(pos.x, 3.5, pos.z);
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

  private addRock(pos: { x: number; y: number; z: number }) {
    const rockGeo = new THREE.DodecahedronGeometry(0.6, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.95 });
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

  clear() {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    for (const body of this.bodies) {
      this.physics.removeBody(body);
    }
    this.meshes = [];
    this.bodies = [];
    this.zoneBounds = [];
  }
}
