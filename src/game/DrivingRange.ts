import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../core/PhysicsWorld';

interface TargetRing {
  distance: number;
  radius: number;
  mesh: THREE.Mesh;
  label: THREE.Mesh;
}

export class DrivingRange {
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  private meshes: THREE.Object3D[] = [];
  private bodies: CANNON.Body[] = [];
  targets: TargetRing[] = [];

  readonly teePosition = { x: 0, z: 0 };

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics;
  }

  build() {
    this.clear();

    // Base ground (rough grass)
    const baseGeo = new THREE.PlaneGeometry(300, 400);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d7a32, roughness: 0.9 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.01;
    base.receiveShadow = true;
    this.scene.add(base);
    this.meshes.push(base);

    // Main fairway strip (center)
    const fairwayGeo = new THREE.PlaneGeometry(40, 320);
    const fairwayMat = new THREE.MeshStandardMaterial({ color: 0x5da84e, roughness: 0.8 });
    const fairway = new THREE.Mesh(fairwayGeo, fairwayMat);
    fairway.rotation.x = -Math.PI / 2;
    fairway.position.set(0, 0.003, -140);
    fairway.receiveShadow = true;
    this.scene.add(fairway);
    this.meshes.push(fairway);

    // Tee box mat
    const teeGeo = new THREE.PlaneGeometry(4, 4);
    const teeMat = new THREE.MeshStandardMaterial({ color: 0x4a8c3f, roughness: 0.7 });
    const tee = new THREE.Mesh(teeGeo, teeMat);
    tee.rotation.x = -Math.PI / 2;
    tee.position.set(0, 0.006, 0);
    tee.receiveShadow = true;
    this.scene.add(tee);
    this.meshes.push(tee);

    // Tee box rubber mat detail
    const matGeo = new THREE.PlaneGeometry(1.5, 2);
    const matMaterial = new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.6 });
    const rubberMat = new THREE.Mesh(matGeo, matMaterial);
    rubberMat.rotation.x = -Math.PI / 2;
    rubberMat.position.set(0, 0.008, 0);
    rubberMat.receiveShadow = true;
    this.scene.add(rubberMat);
    this.meshes.push(rubberMat);

    // Distance marker lines and target circles
    const distances = [50, 100, 150, 200, 250];
    for (const dist of distances) {
      this.addDistanceMarker(dist);
      this.addTarget(dist);
    }

    // Side boundary ropes/posts
    this.addBoundaryPosts(-22, 15);
    this.addBoundaryPosts(22, 15);

    // Decorative trees along edges
    const treePositions = [
      { x: -30, z: -30 }, { x: -28, z: -80 }, { x: -32, z: -140 },
      { x: -30, z: -200 }, { x: -28, z: -260 },
      { x: 30, z: -30 }, { x: 28, z: -80 }, { x: 32, z: -140 },
      { x: 30, z: -200 }, { x: 28, z: -260 },
    ];
    for (const p of treePositions) {
      this.addRangeTree(p.x, p.z);
    }

    // Back net at the far end
    this.addBackNet();
  }

  private addDistanceMarker(distance: number) {
    const z = -distance;

    // Ground stripe
    const stripeGeo = new THREE.PlaneGeometry(30, 0.4);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.8,
    });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.007, z);
    stripe.receiveShadow = true;
    this.scene.add(stripe);
    this.meshes.push(stripe);

    // Distance sign (left side)
    this.addDistanceSign(-18, z, distance);
    // Distance sign (right side)
    this.addDistanceSign(18, z, distance);
  }

  private addDistanceSign(x: number, z: number, distance: number) {
    const group = new THREE.Group();

    // Post
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.3 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 1;
    post.castShadow = true;
    group.add(post);

    // Sign board (doubled resolution)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.roundRect(0, 0, 256, 128, 16);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 6;
    ctx.roundRect(4, 4, 248, 120, 12);
    ctx.stroke();

    // Distance text
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${distance}m`, 128, 68);

    const texture = new THREE.CanvasTexture(canvas);
    const signGeo = new THREE.PlaneGeometry(1.2, 0.6);
    const signMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.y = 2.1;
    sign.castShadow = true;
    group.add(sign);

    // Make sign face the tee
    group.position.set(x, 0, z);
    group.lookAt(0, 0, 0);
    group.rotation.y = Math.atan2(x, -z);

    this.scene.add(group);
    this.meshes.push(group);
  }

  private addTarget(distance: number) {
    const z = -distance;
    const radius = Math.max(3, 8 - distance / 50); // Smaller targets at longer distances

    // Outer ring (white)
    const outerGeo = new THREE.RingGeometry(radius - 0.3, radius, 48);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(0, 0.009, z);
    this.scene.add(outer);
    this.meshes.push(outer);

    // Middle ring (yellow)
    const midRadius = radius * 0.6;
    const midGeo = new THREE.RingGeometry(midRadius - 0.25, midRadius, 48);
    const midMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.35,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const mid = new THREE.Mesh(midGeo, midMat);
    mid.rotation.x = -Math.PI / 2;
    mid.position.set(0, 0.01, z);
    this.scene.add(mid);
    this.meshes.push(mid);

    // Inner bullseye (red)
    const innerRadius = radius * 0.25;
    const innerGeo = new THREE.CircleGeometry(innerRadius, 32);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xcc3333,
      transparent: true,
      opacity: 0.4,
      roughness: 0.8,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(0, 0.011, z);
    this.scene.add(inner);
    this.meshes.push(inner);

    // Center flag/pin
    const flagPoleGeo = new THREE.CylinderGeometry(0.03, 0.03, 2, 8);
    const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.4 });
    const flagPole = new THREE.Mesh(flagPoleGeo, flagPoleMat);
    flagPole.position.set(0, 1, z);
    flagPole.castShadow = true;
    this.scene.add(flagPole);
    this.meshes.push(flagPole);

    // Small flag
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(0.6, 0.15);
    flagShape.lineTo(0, 0.3);
    flagShape.closePath();
    const flagGeo = new THREE.ShapeGeometry(flagShape);
    const flagMat = new THREE.MeshStandardMaterial({
      color: distance <= 100 ? 0xff4444 : distance <= 200 ? 0xffaa00 : 0x4444ff,
      side: THREE.DoubleSide,
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.03, 1.7, z);
    flag.castShadow = true;
    this.scene.add(flag);
    this.meshes.push(flag);

    // Distance label on ground (doubled resolution)
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 96;
    const lctx = labelCanvas.getContext('2d')!;
    lctx.fillStyle = 'rgba(0,0,0,0.4)';
    lctx.roundRect(0, 0, 256, 96, 16);
    lctx.fill();
    lctx.fillStyle = '#ffffff';
    lctx.font = 'bold 48px Arial, sans-serif';
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.fillText(`${distance}m`, 128, 52);

    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelGeo = new THREE.PlaneGeometry(2, 0.75);
    const labelMaterial = new THREE.MeshStandardMaterial({ map: labelTexture, transparent: true, roughness: 0.5 });
    const label = new THREE.Mesh(labelGeo, labelMaterial);
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.013, z + radius + 1);
    this.scene.add(label);
    this.meshes.push(label);

    this.targets.push({ distance, radius, mesh: inner, label });
  }

  private addBoundaryPosts(x: number, spacing: number) {
    for (let z = 0; z > -280; z -= spacing) {
      // Post
      const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.8 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, 0.75, z);
      post.castShadow = true;
      this.scene.add(post);
      this.meshes.push(post);

      // Rope segment to next post
      if (z > -265) {
        const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, spacing, 4);
        const ropeMat = new THREE.MeshStandardMaterial({ color: 0xccaa77, roughness: 0.9 });
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.rotation.x = Math.PI / 2;
        rope.position.set(x, 1.3, z - spacing / 2);
        this.scene.add(rope);
        this.meshes.push(rope);
      }
    }
  }

  private addRangeTree(x: number, z: number) {
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.25, 3, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1.5, z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    this.meshes.push(trunk);

    const foliageGeo = new THREE.SphereGeometry(2.5, 8, 8);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.8 });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.set(x, 4.5, z);
    foliage.castShadow = true;
    this.scene.add(foliage);
    this.meshes.push(foliage);
  }

  private addBackNet() {
    // Net poles
    for (let x = -22; x <= 22; x += 4) {
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 12, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.3 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 6, -290);
      pole.castShadow = true;
      this.scene.add(pole);
      this.meshes.push(pole);
    }

    // Net mesh (semi-transparent plane)
    const netGeo = new THREE.PlaneGeometry(44, 12);
    const netMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    const net = new THREE.Mesh(netGeo, netMat);
    net.position.set(0, 6, -290);
    this.scene.add(net);
    this.meshes.push(net);

    // Physics wall to stop balls
    const wallBody = new CANNON.Body({ mass: 0 });
    wallBody.addShape(new CANNON.Box(new CANNON.Vec3(22, 6, 0.5)));
    wallBody.position.set(0, 6, -290);
    this.physics.addBody(wallBody);
    this.bodies.push(wallBody);
  }

  getDistanceFromTee(x: number, z: number): number {
    const dx = x - this.teePosition.x;
    const dz = z - this.teePosition.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  getClosestTarget(x: number, z: number): { distance: number; accuracy: number } | null {
    let closest: { distance: number; accuracy: number } | null = null;
    let minDist = Infinity;

    for (const target of this.targets) {
      const dx = x - 0; // targets are centered at x=0
      const dz = z - (-target.distance);
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < target.radius && dist < minDist) {
        minDist = dist;
        // Accuracy: 100% at center, 0% at edge
        const accuracy = Math.max(0, (1 - dist / target.radius) * 100);
        closest = { distance: target.distance, accuracy };
      }
    }

    return closest;
  }

  clear() {
    for (const obj of this.meshes) {
      this.scene.remove(obj);
      obj.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }
    for (const body of this.bodies) {
      this.physics.removeBody(body);
    }
    this.meshes = [];
    this.bodies = [];
    this.targets = [];
  }
}
