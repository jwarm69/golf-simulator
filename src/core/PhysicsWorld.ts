import * as CANNON from 'cannon-es';
import { ZONE_PHYSICS, ZoneType, GRAVITY } from '../types';

export class PhysicsWorld {
  world: CANNON.World;
  groundBody: CANNON.Body;
  ballMaterial: CANNON.Material;
  zoneMaterials: Map<ZoneType, CANNON.Material> = new Map();

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -GRAVITY, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    this.ballMaterial = new CANNON.Material('ball');

    // Create materials for each zone type
    for (const [zone, physics] of Object.entries(ZONE_PHYSICS)) {
      const mat = new CANNON.Material(zone);
      this.zoneMaterials.set(zone as ZoneType, mat);

      const contactMat = new CANNON.ContactMaterial(this.ballMaterial, mat, {
        friction: physics.friction,
        restitution: physics.restitution,
      });
      this.world.addContactMaterial(contactMat);
    }

    // Default ground body (rough)
    const roughMat = this.zoneMaterials.get('rough')!;
    const groundShape = new CANNON.Plane();
    this.groundBody = new CANNON.Body({ mass: 0, material: roughMat });
    this.groundBody.addShape(groundShape);
    this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(this.groundBody);
  }

  step(dt: number) {
    this.world.step(1 / 60, dt, 5);
  }

  addBody(body: CANNON.Body) {
    this.world.addBody(body);
  }

  removeBody(body: CANNON.Body) {
    this.world.removeBody(body);
  }

  getMaterialForZone(zone: ZoneType): CANNON.Material {
    return this.zoneMaterials.get(zone) || this.zoneMaterials.get('rough')!;
  }
}
