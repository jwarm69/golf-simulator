import { Game } from './core/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudContainer = document.getElementById('hud') as HTMLElement;

const game = new Game(canvas, hudContainer);
game.showMainMenu().then(() => {
  game.start();
});
