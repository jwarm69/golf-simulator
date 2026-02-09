import { Game } from './core/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudContainer = document.getElementById('hud') as HTMLElement;

const game = new Game(canvas, hudContainer);

// Load first hole, then start loop and show hole picker
game.loadCourse('/courses/course-01.json').then(() => {
  game.start();
  game.showHoleSelection();
});
