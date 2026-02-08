import { Game } from './core/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudContainer = document.getElementById('hud') as HTMLElement;

const game = new Game(canvas, hudContainer);
game.loadCourses([
  '/courses/course-01.json',
  '/courses/course-02.json',
  '/courses/course-03.json',
]).then(() => {
  game.start();
});
