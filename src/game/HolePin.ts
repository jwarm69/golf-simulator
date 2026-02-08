import * as THREE from 'three';
import { HOLE_CUP_RADIUS, HOLE_DETECTION_SPEED } from '../types';

export class HolePin {
  private scene: THREE.Scene;
  private group = new THREE.Group();
  private cupPosition = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  place(x: number, z: number) {
    // Remove previous
    this.scene.remove(this.group);
    this.group = new THREE.Group();

    this.cupPosition.set(x, 0, z);

    // Cup (dark circle on ground)
    const cupGeo = new THREE.CircleGeometry(HOLE_CUP_RADIUS, 32);
    const cupMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });
    const cup = new THREE.Mesh(cupGeo, cupMat);
    cup.rotation.x = -Math.PI / 2;
    cup.position.set(x, 0.01, z);
    this.group.add(cup);

    // Pin (white pole)
    const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 3, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 1.5, z);
    pole.castShadow = true;
    this.group.add(pole);

    // Flag (red triangle)
    const flagGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0,
      0.8, -0.2, 0,
      0, -0.5, 0,
    ]);
    flagGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    flagGeo.computeVertexNormals();
    const flagMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      side: THREE.DoubleSide,
      roughness: 0.7,
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(x, 3, z);
    this.group.add(flag);

    this.scene.add(this.group);
  }

  checkBallInHole(ballX: number, ballZ: number, ballSpeed: number): boolean {
    const dx = ballX - this.cupPosition.x;
    const dz = ballZ - this.cupPosition.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    return dist < HOLE_CUP_RADIUS && ballSpeed < HOLE_DETECTION_SPEED;
  }

  getPosition(): THREE.Vector3 {
    return this.cupPosition.clone();
  }

  clear() {
    this.scene.remove(this.group);
  }
}
