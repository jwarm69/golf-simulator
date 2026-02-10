import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

type QualityTier = 'high' | 'low';

function detectQuality(): QualityTier {
  const isMobile = navigator.maxTouchPoints > 0 || window.innerWidth < 768;
  return isMobile ? 'low' : 'high';
}

export class Renderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private sky: Sky;
  private sunPosition = new THREE.Vector3();
  private composer: EffectComposer;
  private canvas: HTMLCanvasElement;
  private quality: QualityTier;
  private contextLostOverlay: HTMLElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.quality = detectQuality();

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

    const antialias = this.quality === 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const maxPixelRatio = this.quality === 'low' ? 1.5 : 3;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.quality === 'low'
      ? THREE.BasicShadowMap
      : THREE.PCFSoftShadowMap;
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

    // WebGL context loss handling
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.onContextLost();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.onContextRestored();
    });
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

    const shadowSize = this.quality === 'low' ? 1024 : 4096;
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(30, 50, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = shadowSize;
    dirLight.shadow.mapSize.height = shadowSize;
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

  private onContextLost() {
    if (this.contextLostOverlay) return;
    const overlay = document.createElement('div');
    overlay.id = 'context-lost-overlay';

    const text = document.createElement('div');
    text.className = 'context-lost-text';
    text.textContent = 'Restoring graphics…';
    overlay.appendChild(text);

    const sub = document.createElement('div');
    sub.className = 'context-lost-sub';
    sub.textContent = 'Please wait';
    overlay.appendChild(sub);

    document.body.appendChild(overlay);
    this.contextLostOverlay = overlay;
  }

  private onContextRestored() {
    // Three.js automatically restores the WebGL state on context restore,
    // but we need to re-trigger shadow map and tone mapping setup
    this.renderer.shadowMap.needsUpdate = true;

    if (this.contextLostOverlay) {
      this.contextLostOverlay.remove();
      this.contextLostOverlay = null;
    }
  }

  render() {
    this.composer.render();
  }
}
