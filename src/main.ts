import { Game } from './core/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudContainer = document.getElementById('hud') as HTMLElement;

const game = new Game(canvas, hudContainer);

const createStartupError = (message: string, onRetry: () => void) => {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.gap = '12px';
  overlay.style.background = 'rgba(0,0,0,0.78)';
  overlay.style.color = '#fff';
  overlay.style.zIndex = '9999';

  const title = document.createElement('div');
  title.textContent = 'Failed To Start Golf Simulator';
  title.style.fontSize = '24px';
  title.style.fontWeight = '700';
  overlay.appendChild(title);

  const body = document.createElement('div');
  body.textContent = message;
  body.style.opacity = '0.85';
  overlay.appendChild(body);

  const retry = document.createElement('button');
  retry.textContent = 'Retry';
  retry.style.padding = '10px 18px';
  retry.style.borderRadius = '8px';
  retry.style.border = '1px solid rgba(255,255,255,0.5)';
  retry.style.background = 'rgba(255,255,255,0.15)';
  retry.style.color = '#fff';
  retry.style.cursor = 'pointer';
  retry.addEventListener('click', () => {
    overlay.remove();
    onRetry();
  });
  overlay.appendChild(retry);

  document.body.appendChild(overlay);
};

const loadingOverlay = document.getElementById('loading-overlay');

const dismissLoading = () => {
  if (!loadingOverlay) return;
  loadingOverlay.classList.add('fade-out');
  loadingOverlay.addEventListener('transitionend', () => loadingOverlay.remove(), { once: true });
};

const boot = async () => {
  try {
    await game.loadCourse('/courses/course-01.json');
    dismissLoading();
    game.start();
    game.showHoleSelection();
  } catch (error) {
    console.error('Initial course load failed', error);
    if (loadingOverlay) loadingOverlay.remove();
    createStartupError('Could not load course data. Check deployment assets and try again.', () => {
      void boot();
    });
  }
};

void boot();
