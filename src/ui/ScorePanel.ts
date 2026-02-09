export class ScorePanel {
  private panel: HTMLElement;
  private holeScoreEl: HTMLElement;
  private totalEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.className = 'score-panel';

    this.holeScoreEl = document.createElement('div');
    this.holeScoreEl.className = 'score-panel-hole';
    this.panel.appendChild(this.holeScoreEl);

    this.totalEl = document.createElement('div');
    this.totalEl.className = 'score-panel-total';
    this.panel.appendChild(this.totalEl);

    container.appendChild(this.panel);
  }

  update(
    shotCount: number,
    par: number,
    scorecard: { strokes: number; par: number }[]
  ) {
    // Current hole relative to par
    const diff = shotCount - par;
    const diffLabel = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
    this.holeScoreEl.textContent = `Hole: ${shotCount} (${diffLabel})`;

    // Running total across all completed holes + current
    let totalStrokes = shotCount;
    let totalPar = par;
    for (const s of scorecard) {
      totalStrokes += s.strokes;
      totalPar += s.par;
    }
    const totalDiff = totalStrokes - totalPar;
    const totalLabel = totalDiff === 0 ? 'E' : totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`;
    this.totalEl.textContent = `Round: ${totalStrokes} (${totalLabel})`;
  }

  show() {
    this.panel.classList.add('visible');
  }

  hide() {
    this.panel.classList.remove('visible');
  }
}
