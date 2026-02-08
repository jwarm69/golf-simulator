import { Game } from './core/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudContainer = document.getElementById('hud') as HTMLElement;

const game = new Game(canvas, hudContainer);
game.loadCourse('/courses/course-01.json').then(() => {
  game.start();
});
