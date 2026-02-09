import * as THREE from 'three';

/** 2D distance on the XZ plane */
export function distance2D(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Convert a hex color number to a CSS string, e.g. 0xff0000 -> '#ff0000' */
export function hexToCSS(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

/** Get the aim direction vector from a camera orbit angle (points away from camera) */
export function directionFromOrbitAngle(angle: number): THREE.Vector3 {
  return new THREE.Vector3(-Math.sin(angle), 0, -Math.cos(angle));
}

/** Calculate max carry distance for a club given gravity */
export function clubMaxDistance(maxSpeed: number, loftAngle: number, gravity: number): number {
  return Math.round((maxSpeed ** 2 * Math.sin(2 * loftAngle)) / gravity);
}
