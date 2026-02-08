import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../core/PhysicsWorld';
import {
  CourseData, ZoneData, ObstacleData, ZoneType, GreenData,
  THEME_CONFIGS, CourseTheme, ThemeConfig,
} from '../types';

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
  private sponsorMeshes: THREE.Object3D[] = [];
  private greenReadMeshes: THREE.Object3D[] = [];
  private currentThemeConfig: ThemeConfig = THEME_CONFIGS.meadow;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics;
  }

  buildFromCourse(course: CourseData) {
    this.clear();

    const theme: CourseTheme = course.theme ?? 'meadow';
    this.currentThemeConfig = THEME_CONFIGS[theme];

    // Large base ground plane (rough)
    const baseGeo = new THREE.PlaneGeometry(200, 200);
    const baseMat = new THREE.MeshStandardMaterial({
      color: this.currentThemeConfig.groundColor,
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

    // Build sponsor billboards
    if (course.sponsor) {
      this.addSponsorBillboards(course);
    }

    // Build green read indicators
    if (course.green) {
      const greenZone = course.zones.find(z => z.type === 'green');
      if (greenZone) {
        this.addGreenReadIndicators(greenZone, course.green, course.hole);
      }
    }
  }

  private addZone(zone: ZoneData) {
    const color = this.currentThemeConfig.zoneColors[zone.type] ?? this.currentThemeConfig.groundColor;
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
    switch (obstacle.type) {
      case 'tree': this.addTree(obstacle.position); break;
      case 'rock': this.addRock(obstacle.position); break;
      case 'cactus': this.addCactus(obstacle.position); break;
      case 'ice_rock': this.addIceRock(obstacle.position); break;
      case 'snow_tree': this.addSnowTree(obstacle.position); break;
      case 'palm_tree': this.addPalmTree(obstacle.position); break;
      case 'tropical_rock': this.addTropicalRock(obstacle.position); break;
    }
  }

  private addTree(pos: { x: number; y: number; z: number }) {
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 2, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(pos.x, 1, pos.z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    this.meshes.push(trunk);

    const foliageGeo = new THREE.ConeGeometry(1.5, 3, 8);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.8 });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.set(pos.x, 3.5, pos.z);
    foliage.castShadow = true;
    this.scene.add(foliage);
    this.meshes.push(foliage);

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

  private addCactus(pos: { x: number; y: number; z: number }) {
    // Main trunk - tall green cylinder
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.25, 3, 8);
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2d6b2d, roughness: 0.7 });
    const trunk = new THREE.Mesh(trunkGeo, cactusMat);
    trunk.position.set(pos.x, 1.5, pos.z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    this.meshes.push(trunk);

    // Left arm
    const armGeo = new THREE.CylinderGeometry(0.12, 0.15, 1.2, 8);
    const leftArm = new THREE.Mesh(armGeo, cactusMat);
    leftArm.position.set(pos.x - 0.5, 2.2, pos.z);
    leftArm.rotation.z = Math.PI / 4;
    leftArm.castShadow = true;
    this.scene.add(leftArm);
    this.meshes.push(leftArm);

    // Right arm
    const rightArm = new THREE.Mesh(armGeo, cactusMat);
    rightArm.position.set(pos.x + 0.5, 1.8, pos.z);
    rightArm.rotation.z = -Math.PI / 4;
    rightArm.castShadow = true;
    this.scene.add(rightArm);
    this.meshes.push(rightArm);

    // Physics body
    const cactusBody = new CANNON.Body({ mass: 0 });
    cactusBody.addShape(new CANNON.Cylinder(0.35, 0.35, 3, 8));
    cactusBody.position.set(pos.x, 1.5, pos.z);
    this.physics.addBody(cactusBody);
    this.bodies.push(cactusBody);
  }

  private addIceRock(pos: { x: number; y: number; z: number }) {
    // Translucent icy rock formation
    const rockGeo = new THREE.DodecahedronGeometry(0.8, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x88c8e8,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.85,
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(pos.x, 0.5, pos.z);
    rock.castShadow = true;
    this.scene.add(rock);
    this.meshes.push(rock);

    const rockBody = new CANNON.Body({ mass: 0 });
    rockBody.addShape(new CANNON.Sphere(0.8));
    rockBody.position.set(pos.x, 0.5, pos.z);
    this.physics.addBody(rockBody);
    this.bodies.push(rockBody);
  }

  private addSnowTree(pos: { x: number; y: number; z: number }) {
    // Dark trunk
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 2, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(pos.x, 1, pos.z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    this.meshes.push(trunk);

    // Snow-covered foliage (white-tinted cone)
    const foliageGeo = new THREE.ConeGeometry(1.5, 3, 8);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0xc8dcc8, roughness: 0.8 });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.set(pos.x, 3.5, pos.z);
    foliage.castShadow = true;
    this.scene.add(foliage);
    this.meshes.push(foliage);

    // Snow cap on top
    const snowGeo = new THREE.ConeGeometry(1.0, 1.0, 8);
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf0f0ff, roughness: 0.6 });
    const snow = new THREE.Mesh(snowGeo, snowMat);
    snow.position.set(pos.x, 4.5, pos.z);
    snow.castShadow = true;
    this.scene.add(snow);
    this.meshes.push(snow);

    const treeBody = new CANNON.Body({ mass: 0 });
    treeBody.addShape(new CANNON.Cylinder(0.3, 0.3, 4, 8));
    treeBody.position.set(pos.x, 2, pos.z);
    this.physics.addBody(treeBody);
    this.bodies.push(treeBody);
  }

  private addPalmTree(pos: { x: number; y: number; z: number }) {
    // Curved trunk — two tilted segments
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });

    // Lower trunk
    const lowerGeo = new THREE.CylinderGeometry(0.18, 0.25, 3, 8);
    const lower = new THREE.Mesh(lowerGeo, trunkMat);
    lower.position.set(pos.x, 1.5, pos.z);
    lower.rotation.z = 0.1;
    lower.castShadow = true;
    this.scene.add(lower);
    this.meshes.push(lower);

    // Upper trunk
    const upperGeo = new THREE.CylinderGeometry(0.12, 0.18, 2.5, 8);
    const upper = new THREE.Mesh(upperGeo, trunkMat);
    upper.position.set(pos.x + 0.2, 4.2, pos.z);
    upper.rotation.z = 0.15;
    upper.castShadow = true;
    this.scene.add(upper);
    this.meshes.push(upper);

    // Coconut cluster at top
    const coconutMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 });
    for (let i = 0; i < 3; i++) {
      const coconutGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const coconut = new THREE.Mesh(coconutGeo, coconutMat);
      const angle = (i / 3) * Math.PI * 2;
      coconut.position.set(pos.x + 0.3 + Math.cos(angle) * 0.2, 5.3, pos.z + Math.sin(angle) * 0.2);
      this.scene.add(coconut);
      this.meshes.push(coconut);
    }

    // Palm fronds — flat elliptical shapes fanning out
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const frondGeo = new THREE.PlaneGeometry(0.8, 3);
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.set(
        pos.x + 0.3 + Math.cos(angle) * 1.2,
        5.0 + Math.random() * 0.3,
        pos.z + Math.sin(angle) * 1.2
      );
      frond.rotation.x = -0.6 - Math.random() * 0.3;
      frond.rotation.y = angle;
      frond.castShadow = true;
      this.scene.add(frond);
      this.meshes.push(frond);
    }

    // Physics body
    const palmBody = new CANNON.Body({ mass: 0 });
    palmBody.addShape(new CANNON.Cylinder(0.3, 0.3, 5, 8));
    palmBody.position.set(pos.x, 2.5, pos.z);
    this.physics.addBody(palmBody);
    this.bodies.push(palmBody);
  }

  private addTropicalRock(pos: { x: number; y: number; z: number }) {
    // Mossy volcanic rock
    const rockGeo = new THREE.DodecahedronGeometry(0.7, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.95 });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(pos.x, 0.4, pos.z);
    rock.scale.set(1, 0.7, 1);
    rock.castShadow = true;
    this.scene.add(rock);
    this.meshes.push(rock);

    // Moss patch on top
    const mossGeo = new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const mossMat = new THREE.MeshStandardMaterial({
      color: 0x3a7a2a,
      roughness: 0.9,
      transparent: true,
      opacity: 0.7,
    });
    const moss = new THREE.Mesh(mossGeo, mossMat);
    moss.position.set(pos.x, 0.6, pos.z);
    this.scene.add(moss);
    this.meshes.push(moss);

    const rockBody = new CANNON.Body({ mass: 0 });
    rockBody.addShape(new CANNON.Sphere(0.7));
    rockBody.position.set(pos.x, 0.4, pos.z);
    this.physics.addBody(rockBody);
    this.bodies.push(rockBody);
  }

  private addSponsorBillboards(course: CourseData) {
    const sponsor = course.sponsor!;
    const primaryColor = new THREE.Color(sponsor.primaryColor);
    const secondaryColor = new THREE.Color(sponsor.secondaryColor ?? '#ffffff');

    // Billboard positions: one near tee, one along fairway midpoint
    const midX = (course.tee.x + course.hole.x) / 2;
    const midZ = (course.tee.z + course.hole.z) / 2;

    const billboardPositions = [
      { x: course.tee.x + 8, z: course.tee.z, rotY: -Math.PI / 4 },
      { x: midX - 10, z: midZ, rotY: Math.PI / 6 },
    ];

    for (const bp of billboardPositions) {
      const group = new THREE.Group();

      // Billboard backing panel
      const panelGeo = new THREE.BoxGeometry(5, 2.5, 0.15);
      const panelMat = new THREE.MeshStandardMaterial({
        color: primaryColor,
        roughness: 0.4,
        metalness: 0.1,
      });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.y = 3.5;
      panel.castShadow = true;
      group.add(panel);

      // Border frame
      const borderGeo = new THREE.BoxGeometry(5.2, 2.7, 0.1);
      const borderMat = new THREE.MeshStandardMaterial({
        color: secondaryColor,
        roughness: 0.3,
        metalness: 0.2,
      });
      const border = new THREE.Mesh(borderGeo, borderMat);
      border.position.y = 3.5;
      border.position.z = -0.05;
      group.add(border);

      // Support poles
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.75, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.5 });

      const leftPole = new THREE.Mesh(poleGeo, poleMat);
      leftPole.position.set(-2, 2.375, 0);
      leftPole.castShadow = true;
      group.add(leftPole);

      const rightPole = new THREE.Mesh(poleGeo, poleMat);
      rightPole.position.set(2, 2.375, 0);
      rightPole.castShadow = true;
      group.add(rightPole);

      // Sponsor text rendered on a canvas texture
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;

      // Background
      ctx.fillStyle = sponsor.primaryColor;
      ctx.fillRect(0, 0, 512, 256);

      // "SPONSORED BY" text
      ctx.fillStyle = sponsor.secondaryColor ?? '#ffffff';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('SPONSORED BY', 256, 30);

      // Sponsor name
      ctx.font = 'bold 52px Arial, sans-serif';
      ctx.fillText(sponsor.name, 256, 80);

      // Tagline
      if (sponsor.tagline) {
        ctx.font = '24px Arial, sans-serif';
        ctx.fillText(sponsor.tagline, 256, 145);
      }

      // Website URL
      if (sponsor.website) {
        ctx.font = '18px Arial, sans-serif';
        ctx.globalAlpha = 0.8;
        const displayUrl = sponsor.website.replace(/^https?:\/\//, '');
        ctx.fillText(displayUrl, 256, 180);
        ctx.globalAlpha = 1.0;
      }

      // Tier badge
      const tierLabels = { hole: 'HOLE SPONSOR', course: 'COURSE SPONSOR', designer: 'HOLE DESIGNER' };
      ctx.font = 'bold 20px Arial, sans-serif';
      const tierLabel = tierLabels[sponsor.tier];
      const tierWidth = ctx.measureText(tierLabel).width + 20;
      ctx.fillStyle = sponsor.secondaryColor ?? '#ffffff';
      ctx.fillRect(256 - tierWidth / 2, 210, tierWidth, 30);
      ctx.fillStyle = sponsor.primaryColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(tierLabel, 256, 225);

      const texture = new THREE.CanvasTexture(canvas);
      const textGeo = new THREE.PlaneGeometry(4.6, 2.3);
      const textMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.5,
      });
      const textMesh = new THREE.Mesh(textGeo, textMat);
      textMesh.position.y = 3.5;
      textMesh.position.z = 0.08;
      group.add(textMesh);

      group.position.set(bp.x, 0, bp.z);
      group.rotation.y = bp.rotY;

      this.scene.add(group);
      this.sponsorMeshes.push(group);

      // Physics body for billboard poles
      const billboardBody = new CANNON.Body({ mass: 0 });
      billboardBody.addShape(new CANNON.Box(new CANNON.Vec3(0.1, 2.4, 0.1)), new CANNON.Vec3(-2, 2.4, 0));
      billboardBody.addShape(new CANNON.Box(new CANNON.Vec3(0.1, 2.4, 0.1)), new CANNON.Vec3(2, 2.4, 0));
      billboardBody.position.set(bp.x, 0, bp.z);
      billboardBody.quaternion.setFromEuler(0, bp.rotY, 0);
      this.physics.addBody(billboardBody);
      this.bodies.push(billboardBody);
    }
  }

  private addGreenReadIndicators(greenZone: ZoneData, greenData: GreenData, holePos: { x: number; z: number }) {
    const cx = greenZone.position.x;
    const cz = greenZone.position.z;
    const radius = greenZone.radius ?? 5;

    // Slope direction in radians
    const slopeRad = (greenData.slopeAngle * Math.PI) / 180;
    const slopeDirX = Math.cos(slopeRad);
    const slopeDirZ = Math.sin(slopeRad);

    // Speed color ring on the green surface
    const speedColors: Record<string, number> = {
      slow: 0x4a9e4a,
      medium: 0x5ec85e,
      fast: 0x7ee87e,
    };
    const ringGeo = new THREE.RingGeometry(radius - 0.6, radius - 0.15, 48);
    const ringMat = new THREE.MeshStandardMaterial({
      color: speedColors[greenData.speed] ?? 0x5ec85e,
      transparent: true,
      opacity: 0.4,
      roughness: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.008, cz);
    this.scene.add(ring);
    this.greenReadMeshes.push(ring);

    // Slope arrows scattered across the green
    const arrowColor = 0xffffff;
    const arrowOpacity = 0.3 + greenData.slopeStrength * 0.4;
    const arrowPositions = this.getGreenArrowPositions(cx, cz, radius, holePos);

    for (const ap of arrowPositions) {
      const arrow = this.createSlopeArrow(arrowColor, arrowOpacity);
      arrow.position.set(ap.x, 0.012, ap.z);
      arrow.rotation.y = -slopeRad + Math.PI / 2;
      this.scene.add(arrow);
      this.greenReadMeshes.push(arrow);
    }

    // Speed label at edge of green (canvas texture)
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const lctx = labelCanvas.getContext('2d')!;
    lctx.fillStyle = 'rgba(0,0,0,0.5)';
    lctx.roundRect(0, 0, 256, 64, 10);
    lctx.fill();
    lctx.fillStyle = '#ffffff';
    lctx.font = 'bold 28px Arial, sans-serif';
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    const speedLabel = greenData.speed.toUpperCase() + ' GREEN';
    lctx.fillText(speedLabel, 128, 32);

    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelGeo = new THREE.PlaneGeometry(2.5, 0.6);
    const labelMat = new THREE.MeshStandardMaterial({
      map: labelTexture,
      transparent: true,
      roughness: 0.5,
    });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.rotation.x = -Math.PI / 2;
    labelMesh.position.set(cx, 0.015, cz + radius - 0.8);
    this.scene.add(labelMesh);
    this.greenReadMeshes.push(labelMesh);
  }

  private getGreenArrowPositions(cx: number, cz: number, radius: number, holePos: { x: number; z: number }): { x: number; z: number }[] {
    const positions: { x: number; z: number }[] = [];
    const spacing = 2.2;
    const r2 = (radius - 1.0) * (radius - 1.0);
    const holeR2 = 1.5 * 1.5; // avoid placing arrows near the hole cup

    for (let dx = -radius + 1; dx <= radius - 1; dx += spacing) {
      for (let dz = -radius + 1; dz <= radius - 1; dz += spacing) {
        if (dx * dx + dz * dz < r2) {
          const ax = cx + dx;
          const az = cz + dz;
          const hdx = ax - holePos.x;
          const hdz = az - holePos.z;
          if (hdx * hdx + hdz * hdz > holeR2) {
            positions.push({ x: ax, z: az });
          }
        }
      }
    }
    return positions;
  }

  private createSlopeArrow(color: number, opacity: number): THREE.Mesh {
    // Small flat arrow shape (triangle + shaft)
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.4);       // tip
    shape.lineTo(-0.2, 0.15);   // left barb
    shape.lineTo(-0.08, 0.15);  // inner left
    shape.lineTo(-0.08, -0.3);  // shaft bottom left
    shape.lineTo(0.08, -0.3);   // shaft bottom right
    shape.lineTo(0.08, 0.15);   // inner right
    shape.lineTo(0.2, 0.15);    // right barb
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  getZoneAtPosition(x: number, z: number): ZoneType {
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
    for (const obj of this.sponsorMeshes) {
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
    for (const obj of this.greenReadMeshes) {
      this.scene.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    }
    for (const body of this.bodies) {
      this.physics.removeBody(body);
    }
    this.meshes = [];
    this.bodies = [];
    this.zoneBounds = [];
    this.sponsorMeshes = [];
    this.greenReadMeshes = [];
  }
}
