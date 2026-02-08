import { SponsorData } from '../types';

export class HUD {
  private container: HTMLElement;
  private topLeft!: HTMLElement;
  private topRight!: HTMLElement;
  private powerContainer!: HTMLElement;
  private powerFill!: HTMLElement;
  private powerLabel!: HTMLElement;
  private centerMessage!: HTMLElement;
  private aimHint!: HTMLElement;
  private transitionOverlay!: HTMLElement;

  private holeNameEl!: HTMLElement;
  private shotInfoEl!: HTMLElement;
  private distanceEl!: HTMLElement;
  private clubEl!: HTMLElement;
  private scorecardEl!: HTMLElement;
  private sponsorBanner!: HTMLElement;
  private holeProgressEl!: HTMLElement;
  private cumulativeScoreEl!: HTMLElement;

  onClubPrev?: () => void;
  onClubNext?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.build();
  }

  private build() {
    this.container.innerHTML = '';

    // Top left: hole name + shot info + progress + scorecard
    this.topLeft = document.createElement('div');
    this.topLeft.className = 'hud-top-left';
    this.holeNameEl = document.createElement('div');
    this.holeNameEl.className = 'hole-name';
    this.shotInfoEl = document.createElement('div');
    this.shotInfoEl.className = 'shot-info';
    this.holeProgressEl = document.createElement('div');
    this.holeProgressEl.className = 'hole-progress';
    this.cumulativeScoreEl = document.createElement('div');
    this.cumulativeScoreEl.className = 'cumulative-score';
    this.scorecardEl = document.createElement('div');
    this.scorecardEl.className = 'scorecard';
    this.topLeft.appendChild(this.holeNameEl);
    this.topLeft.appendChild(this.shotInfoEl);
    this.topLeft.appendChild(this.holeProgressEl);
    this.topLeft.appendChild(this.cumulativeScoreEl);
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

    // Sponsor banner (bottom-right)
    this.sponsorBanner = document.createElement('div');
    this.sponsorBanner.className = 'sponsor-banner';
    this.container.appendChild(this.sponsorBanner);

    // Transition overlay (between holes)
    this.transitionOverlay = document.createElement('div');
    this.transitionOverlay.className = 'transition-overlay';
    this.container.appendChild(this.transitionOverlay);

    // Power meter
    this.powerContainer = document.createElement('div');
    this.powerContainer.className = 'power-meter-container';
    this.powerFill = document.createElement('div');
    this.powerFill.className = 'power-meter-fill';
    this.powerContainer.appendChild(this.powerFill);
    this.container.appendChild(this.powerContainer);

    this.powerLabel = document.createElement('div');
    this.powerLabel.className = 'power-meter-label';
    this.powerLabel.textContent = 'Hold SPACE to set power';
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
    this.aimHint.textContent = 'A/D to aim  |  Q/E change club  |  SPACE to shoot  |  Scroll to adjust view';
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

  setHoleProgress(current: number, total: number) {
    this.holeProgressEl.textContent = `Hole ${current} of ${total}`;
  }

  setCumulativeScore(totalStrokes: number, totalPar: number) {
    if (totalStrokes === 0) {
      this.cumulativeScoreEl.textContent = '';
      return;
    }
    const diff = totalStrokes - totalPar;
    const label = diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`);
    this.cumulativeScoreEl.textContent = `Round: ${totalStrokes} strokes (${label})`;
  }

  setSponsor(sponsor: SponsorData | undefined) {
    if (!sponsor) {
      this.sponsorBanner.classList.remove('visible');
      return;
    }

    const tierLabels = { hole: 'Hole Sponsor', course: 'Course Sponsor', designer: 'Hole Designer' };
    this.sponsorBanner.innerHTML = '';

    const tierEl = document.createElement('div');
    tierEl.className = 'sponsor-tier';
    tierEl.textContent = tierLabels[sponsor.tier];
    tierEl.style.background = sponsor.primaryColor;
    tierEl.style.color = sponsor.secondaryColor ?? '#ffffff';

    const nameEl = document.createElement('div');
    nameEl.className = 'sponsor-name';
    nameEl.textContent = sponsor.name;
    nameEl.style.color = sponsor.primaryColor;

    this.sponsorBanner.appendChild(tierEl);
    this.sponsorBanner.appendChild(nameEl);

    if (sponsor.tagline) {
      const tagEl = document.createElement('div');
      tagEl.className = 'sponsor-tagline';
      tagEl.textContent = sponsor.tagline;
      this.sponsorBanner.appendChild(tagEl);
    }

    this.sponsorBanner.classList.add('visible');
  }

  showTransition(opts: {
    holeName: string;
    holeNumber: number;
    totalHoles: number;
    par: number;
    sponsor?: SponsorData;
    scorecard: number[];
    pars: number[];
  }): Promise<void> {
    return new Promise((resolve) => {
      this.transitionOverlay.innerHTML = '';

      // Running score summary (if any holes completed)
      if (opts.scorecard.length > 0) {
        const summaryEl = document.createElement('div');
        summaryEl.className = 'transition-summary';

        const totalStrokes = opts.scorecard.reduce((a, b) => a + b, 0);
        const totalPar = opts.pars.slice(0, opts.scorecard.length).reduce((a, b) => a + b, 0);
        const diff = totalStrokes - totalPar;
        const diffLabel = diff === 0 ? 'Even' : (diff > 0 ? `+${diff}` : `${diff}`);

        summaryEl.innerHTML = `<div class="transition-score-label">Score so far</div>`
          + `<div class="transition-score-value">${totalStrokes} (${diffLabel})</div>`
          + `<div class="transition-score-holes">${opts.scorecard.map((s, i) => {
              const d = s - opts.pars[i];
              const l = d === 0 ? 'E' : (d > 0 ? `+${d}` : `${d}`);
              return `H${i + 1}: ${s}(${l})`;
            }).join('  ')}</div>`;

        this.transitionOverlay.appendChild(summaryEl);
      }

      // "UP NEXT" label
      const upNextLabel = document.createElement('div');
      upNextLabel.className = 'transition-up-next';
      upNextLabel.textContent = opts.scorecard.length === 0 ? 'FIRST HOLE' : 'UP NEXT';
      this.transitionOverlay.appendChild(upNextLabel);

      // Hole name
      const nameEl = document.createElement('div');
      nameEl.className = 'transition-hole-name';
      nameEl.textContent = opts.holeName;
      this.transitionOverlay.appendChild(nameEl);

      // Hole info
      const infoEl = document.createElement('div');
      infoEl.className = 'transition-hole-info';
      infoEl.textContent = `Hole ${opts.holeNumber} of ${opts.totalHoles}  |  Par ${opts.par}`;
      this.transitionOverlay.appendChild(infoEl);

      // Sponsor callout
      if (opts.sponsor) {
        const tierLabels = { hole: 'Sponsored by', course: 'Course Sponsor', designer: 'Designed by' };
        const sponsorEl = document.createElement('div');
        sponsorEl.className = 'transition-sponsor';
        sponsorEl.innerHTML = `<span class="transition-sponsor-tier">${tierLabels[opts.sponsor.tier]}</span> `
          + `<span class="transition-sponsor-name" style="color:${opts.sponsor.primaryColor}">${opts.sponsor.name}</span>`;
        this.transitionOverlay.appendChild(sponsorEl);
      }

      // Click prompt
      const clickEl = document.createElement('div');
      clickEl.className = 'transition-click';
      clickEl.textContent = 'Click to tee off';
      this.transitionOverlay.appendChild(clickEl);

      // Show
      this.transitionOverlay.classList.add('visible');

      const onClick = () => {
        window.removeEventListener('click', onClick);
        this.transitionOverlay.classList.remove('visible');
        resolve();
      };
      // Short delay so the overlay is readable before accepting clicks
      setTimeout(() => {
        window.addEventListener('click', onClick);
      }, 800);
    });
  }

  hideTransition() {
    this.transitionOverlay.classList.remove('visible');
  }

  showPowerMeter(visible: boolean) {
    this.powerContainer.classList.toggle('visible', visible);
    this.powerLabel.classList.toggle('visible', visible);
  }

  setPower(power: number) {
    const pct = power * 100;
    this.powerFill.style.width = `${pct}%`;

    // Color gradient: green -> yellow -> red
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

  setScorecard(scores: number[], pars: number[]) {
    if (scores.length === 0) {
      this.scorecardEl.textContent = '';
      return;
    }
    const parts = scores.map((s, i) => {
      const par = pars[i] ?? pars[0];
      const diff = s - par;
      const label = diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`);
      return `H${i + 1}: ${s} (${label})`;
    });

    const totalStrokes = scores.reduce((a, b) => a + b, 0);
    const totalPar = pars.slice(0, scores.length).reduce((a, b) => a + b, 0);
    const totalDiff = totalStrokes - totalPar;
    const totalLabel = totalDiff === 0 ? 'E' : (totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`);
    parts.push(`Total: ${totalStrokes} (${totalLabel})`);

    this.scorecardEl.textContent = parts.join('  |  ');
  }
}
