import * as THREE from 'three';

const LINE_LENGTH = 4;
const DOT_COUNT = 16;
const DOT_SIZE = 0.08;

export class PuttingGuide {
  private group = new THREE.Group();
  private dots: THREE.Mesh[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create small flat circles on the ground as a dotted aim line
    const geo = new THREE.CircleGeometry(DOT_SIZE, 8);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < DOT_COUNT; i++) {
      const dot = new THREE.Mesh(geo, mat.clone());
      this.group.add(dot);
      this.dots.push(dot);
    }

    this.group.visible = false;
    scene.add(this.group);
  }

  update(ballPos: THREE.Vector3, orbitAngle: number, power: number | null) {
    // Direction the putt will go (opposite camera orbit, same as shot direction)
    const dx = -Math.sin(orbitAngle);
    const dz = -Math.cos(orbitAngle);

    const lineLen = power !== null ? LINE_LENGTH * power : LINE_LENGTH * 0.5;

    for (let i = 0; i < DOT_COUNT; i++) {
      const t = (i + 1) / DOT_COUNT;
      const dist = t * lineLen;
      const dot = this.dots[i];
      dot.position.set(
        ballPos.x + dx * dist,
        0.015,
        ballPos.z + dz * dist
      );

      // Fade out toward end
      const opacity = 0.7 * (1 - t * 0.6);
      (dot.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  dispose() {
    this.scene.remove(this.group);
    for (const dot of this.dots) {
      dot.geometry.dispose();
      (dot.material as THREE.Material).dispose();
    }
  }
}
