export class HUD {
  private container: HTMLElement;
  private topLeft!: HTMLElement;
  private topRight!: HTMLElement;
  private powerContainer!: HTMLElement;
  private powerFill!: HTMLElement;
  private powerLabel!: HTMLElement;
  private centerMessage!: HTMLElement;
  private aimHint!: HTMLElement;

  private holeNameEl!: HTMLElement;
  private shotInfoEl!: HTMLElement;
  private distanceEl!: HTMLElement;
  private clubEl!: HTMLElement;
  private scorecardEl!: HTMLElement;

  onClubPrev?: () => void;
  onClubNext?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.build();
  }

  private build() {
    this.container.innerHTML = '';

    // Top left: hole name + shot info
    this.topLeft = document.createElement('div');
    this.topLeft.className = 'hud-top-left';
    this.holeNameEl = document.createElement('div');
    this.holeNameEl.className = 'hole-name';
    this.shotInfoEl = document.createElement('div');
    this.shotInfoEl.className = 'shot-info';
    this.scorecardEl = document.createElement('div');
    this.scorecardEl.className = 'scorecard';
    this.topLeft.appendChild(this.holeNameEl);
    this.topLeft.appendChild(this.shotInfoEl);
    this.topLeft.appendChild(this.scorecardEl);
    this.container.appendChild(this.topLeft);

    // Top right: distance
    this.topRight = document.createElement('div');
    this.topRight.className = 'hud-top-right';
    this.distanceEl = document.createElement('div');
    this.distanceEl.className = 'distance';
    const distLabel = document.createElement('div');
    distLabel.className = 'distance-label';
    distLabel.textContent = 'TO PIN';
    this.topRight.appendChild(this.distanceEl);
    this.topRight.appendChild(distLabel);
    this.container.appendChild(this.topRight);

    // Power meter
    this.powerContainer = document.createElement('div');
    this.powerContainer.className = 'power-meter-container';
    this.powerFill = document.createElement('div');
    this.powerFill.className = 'power-meter-fill';
    this.powerContainer.appendChild(this.powerFill);
    this.container.appendChild(this.powerContainer);

    this.powerLabel = document.createElement('div');
    this.powerLabel.className = 'power-meter-label';
    this.powerLabel.textContent = this.isTouchDevice()
      ? 'Tap to shoot!'
      : 'Hold SPACE to set power';
    this.container.appendChild(this.powerLabel);

    // Center message
    this.centerMessage = document.createElement('div');
    this.centerMessage.className = 'center-message';
    this.container.appendChild(this.centerMessage);

    // Club display with mobile buttons
    const clubRow = document.createElement('div');
    clubRow.className = 'club-row';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'club-btn';
    prevBtn.textContent = '\u25C0';
    prevBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.onClubPrev?.(); });
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onClubPrev?.(); });

    this.clubEl = document.createElement('div');
    this.clubEl.className = 'club-display';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'club-btn';
    nextBtn.textContent = '\u25B6';
    nextBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.onClubNext?.(); });
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onClubNext?.(); });

    clubRow.appendChild(prevBtn);
    clubRow.appendChild(this.clubEl);
    clubRow.appendChild(nextBtn);
    this.container.appendChild(clubRow);

    // Aim hint
    this.aimHint = document.createElement('div');
    this.aimHint.className = 'aim-hint';
    this.aimHint.textContent = this.isTouchDevice()
      ? 'Swipe to aim  |  Tap to charge  |  Tap again to shoot'
      : 'A/D to aim  |  Q/E change club  |  SPACE to shoot  |  Scroll to adjust view';
    this.container.appendChild(this.aimHint);
  }

  setHoleName(name: string) {
    this.holeNameEl.textContent = name;
  }

  setShotInfo(shots: number, par: number) {
    this.shotInfoEl.textContent = `Shot ${shots + 1}  |  Par ${par}`;
  }

  setDistance(meters: number) {
    this.distanceEl.textContent = `${meters.toFixed(1)}m`;
  }

  showPowerMeter(visible: boolean) {
    this.powerContainer.classList.toggle('visible', visible);
    this.powerLabel.classList.toggle('visible', visible);
  }

  setPower(power: number) {
    const pct = power * 100;
    this.powerFill.style.width = `${pct}%`;

    // Color gradient: green → yellow → red
    if (power < 0.5) {
      const t = power / 0.5;
      const r = Math.round(t * 255);
      const g = 200;
      this.powerFill.style.background = `rgb(${r}, ${g}, 50)`;
    } else {
      const t = (power - 0.5) / 0.5;
      const g = Math.round((1 - t) * 200);
      this.powerFill.style.background = `rgb(255, ${g}, 50)`;
    }
  }

  showMessage(text: string, sub?: string) {
    let html = text;
    if (sub) html += `<div class="sub">${sub}</div>`;
    this.centerMessage.innerHTML = html;
    this.centerMessage.classList.add('visible');
  }

  hideMessage() {
    this.centerMessage.classList.remove('visible');
  }

  showAimHint(visible: boolean) {
    this.aimHint.style.opacity = visible ? '1' : '0';
  }

  setClub(name: string, maxDist: number) {
    this.clubEl.textContent = `${name}  —  ${maxDist}m`;
  }

  private isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  setScorecard(scores: number[], par: number) {
    const parts = scores.map((s, i) => {
      const diff = s - par;
      const label = diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`);
      return `R${i + 1}: ${s} (${label})`;
    });
    this.scorecardEl.textContent = parts.join('  |  ');
  }
}
