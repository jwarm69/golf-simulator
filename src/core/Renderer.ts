import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

export class Renderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private sky: Sky;
  private sunPosition = new THREE.Vector3();
  private composer: EffectComposer;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.fog = null;

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.camera.position.set(0, 10, 15);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.5;

    // Post-processing pipeline
    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // SSAO pass for ambient occlusion
    const ssaoPass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = 0.8;
    ssaoPass.minDistance = 0.001;
    ssaoPass.maxDistance = 0.15;
    (ssaoPass.output as number) = SSAOPass.OUTPUT.Default;
    this.composer.addPass(ssaoPass);

    // Bloom pass for glow on bright surfaces
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3,   // strength
      0.6,   // radius
      0.85   // threshold
    );
    this.composer.addPass(bloomPass);

    // Gamma correction as final pass
    const gammaPass = new ShaderPass(GammaCorrectionShader);
    this.composer.addPass(gammaPass);

    this.sky = this.setupSky();
    this.setupLighting();

    window.addEventListener('resize', () => this.onResize());
  }

  private setupSky(): Sky {
    const sky = new Sky();
    sky.scale.setScalar(450000);
    this.scene.add(sky);

    const uniforms = sky.material.uniforms;
    uniforms['turbidity'].value = 2;
    uniforms['rayleigh'].value = 1;
    uniforms['mieCoefficient'].value = 0.005;
    uniforms['mieDirectionalG'].value = 0.8;

    // Sun position matching directional light at (30, 50, 20)
    const phi = THREE.MathUtils.degToRad(90 - 50);
    const theta = Math.atan2(30, 20);
    this.sunPosition.setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition'].value.copy(this.sunPosition);

    // No fog — clear view of the course

    return sky;
  }

  setFogColor(_color: number) {
    // Fog disabled — no-op
  }

  private setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d6e3f, 0.6);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(30, 50, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    this.scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    this.scene.add(ambientLight);
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.composer.render();
  }
}
