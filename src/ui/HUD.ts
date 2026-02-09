import type { RangeStats } from '../game/RangeManager';

export interface HoleOption {
  path: string;
  name: string;
  par: number;
  best?: number;
}

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
  private sponsorEl!: HTMLElement;
  private holeSelectOverlay!: HTMLElement;
  private windEl!: HTMLElement;
  private windArrow!: HTMLElement;
  private windSpeed!: HTMLElement;
  private spinEl!: HTMLElement;
  private turnBanner!: HTMLElement;
  private autoClubHint!: HTMLElement;
  private multiplayerSetupOverlay!: HTMLElement;
  private roundSummaryOverlay!: HTMLElement;
  private rangeHUD!: HTMLElement;

  onClubPrev?: () => void;
  onClubNext?: () => void;
  onShotHoldStart?: () => void;
  onShotHoldEnd?: () => void;
  onSpinDrawStart?: () => void;
  onSpinDrawEnd?: () => void;
  onSpinFadeStart?: () => void;
  onSpinFadeEnd?: () => void;
  onHoleSelect?: (path: string) => void;
  onMultiplayerSetup?: (names: string[]) => void;
  onSinglePlayer?: () => void;
  onMenuToggle?: () => void;
  onRangeSelect?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.build();
  }

  private bindHoldEvents(
    button: HTMLElement,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    button.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onStart?.();
    });
    button.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onEnd?.();
    });
    button.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onEnd?.();
    });
    button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onStart?.();
    });
    button.addEventListener('mouseup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onEnd?.();
    });
    button.addEventListener('mouseleave', () => onEnd?.());
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

    // Top right: distance + wind
    this.topRight = document.createElement('div');
    this.topRight.className = 'hud-top-right';
    this.distanceEl = document.createElement('div');
    this.distanceEl.className = 'distance';
    const distLabel = document.createElement('div');
    distLabel.className = 'distance-label';
    distLabel.textContent = 'TO PIN';
    this.topRight.appendChild(this.distanceEl);
    this.topRight.appendChild(distLabel);

    // Wind indicator
    this.windEl = document.createElement('div');
    this.windEl.className = 'wind-indicator';
    this.windArrow = document.createElement('div');
    this.windArrow.className = 'wind-arrow';
    this.windArrow.textContent = '\u2191';
    this.windSpeed = document.createElement('div');
    this.windSpeed.className = 'wind-speed';
    this.windEl.appendChild(this.windArrow);
    this.windEl.appendChild(this.windSpeed);
    this.topRight.appendChild(this.windEl);

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
    const isTouch = matchMedia('(pointer: coarse)').matches;
    this.powerLabel.textContent = isTouch ? 'Hold button to shoot' : 'SPACE / Hold to shoot';
    this.container.appendChild(this.powerLabel);

    // Center message
    this.centerMessage = document.createElement('div');
    this.centerMessage.className = 'center-message';
    this.container.appendChild(this.centerMessage);

    // Turn banner (multiplayer)
    this.turnBanner = document.createElement('div');
    this.turnBanner.className = 'turn-banner';
    this.container.appendChild(this.turnBanner);

    // Mobile menu button
    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-toggle-btn';
    menuBtn.textContent = '\u2630';
    menuBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onMenuToggle?.();
    });
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onMenuToggle?.();
    });
    this.container.appendChild(menuBtn);

    // Auto-club hint
    this.autoClubHint = document.createElement('div');
    this.autoClubHint.className = 'auto-club-hint';
    this.container.appendChild(this.autoClubHint);

    // Club display with buttons (visible on all devices)
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

    // Spin indicator
    this.spinEl = document.createElement('div');
    this.spinEl.className = 'spin-indicator';
    this.spinEl.textContent = 'STRAIGHT';
    this.container.appendChild(this.spinEl);

    // Mobile spin controls
    const spinControls = document.createElement('div');
    spinControls.className = 'spin-controls';
    const drawBtn = document.createElement('button');
    drawBtn.className = 'spin-btn';
    drawBtn.textContent = 'DRAW';
    this.bindHoldEvents(drawBtn, () => this.onSpinDrawStart?.(), () => this.onSpinDrawEnd?.());
    const fadeBtn = document.createElement('button');
    fadeBtn.className = 'spin-btn';
    fadeBtn.textContent = 'FADE';
    this.bindHoldEvents(fadeBtn, () => this.onSpinFadeStart?.(), () => this.onSpinFadeEnd?.());
    spinControls.appendChild(drawBtn);
    spinControls.appendChild(fadeBtn);
    this.container.appendChild(spinControls);

    // Mobile hold-to-shoot button
    const shotButton = document.createElement('button');
    shotButton.className = 'shot-hold-btn';
    shotButton.textContent = 'HOLD TO SHOOT';
    this.bindHoldEvents(shotButton, () => this.onShotHoldStart?.(), () => this.onShotHoldEnd?.());
    this.container.appendChild(shotButton);

    // Aim hint — different text for touch vs desktop
    this.aimHint = document.createElement('div');
    this.aimHint.className = 'aim-hint';
    if (isTouch) {
      this.aimHint.innerHTML = 'Swipe to aim &nbsp;|&nbsp; \u25C0 \u25B6 club &nbsp;|&nbsp; DRAW/FADE spin';
    } else {
      this.aimHint.innerHTML = 'A/D or Drag to aim &nbsp;|&nbsp; Q/E or <b>\u25C0 \u25B6</b> change club &nbsp;|&nbsp; Z/C spin &nbsp;|&nbsp; SPACE or Hold to shoot &nbsp;|&nbsp; Scroll to adjust view';
    }
    this.container.appendChild(this.aimHint);

    // Sponsor bar
    this.sponsorEl = document.createElement('div');
    this.sponsorEl.className = 'sponsor-bar';
    this.sponsorEl.innerHTML = 'Sponsored by <strong>Warman Golf</strong>';
    this.container.appendChild(this.sponsorEl);

    // Hole selection overlay (hidden by default)
    this.holeSelectOverlay = document.createElement('div');
    this.holeSelectOverlay.className = 'hole-select-overlay';
    this.container.appendChild(this.holeSelectOverlay);

    // Multiplayer setup overlay
    this.multiplayerSetupOverlay = document.createElement('div');
    this.multiplayerSetupOverlay.className = 'hole-select-overlay';
    this.container.appendChild(this.multiplayerSetupOverlay);

    // Round summary overlay
    this.roundSummaryOverlay = document.createElement('div');
    this.roundSummaryOverlay.className = 'hole-select-overlay';
    this.container.appendChild(this.roundSummaryOverlay);

    // Range HUD
    this.rangeHUD = document.createElement('div');
    this.rangeHUD.className = 'range-hud';
    this.rangeHUD.innerHTML = '<div class="range-stat">Last: --m</div><div class="range-stat">Targets: 0</div>';
    this.container.appendChild(this.rangeHUD);
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

  showMessageSafe(text: string, sub?: string) {
    this.centerMessage.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = text;
    this.centerMessage.appendChild(title);
    if (sub) {
      const subEl = document.createElement('div');
      subEl.className = 'sub';
      subEl.textContent = sub;
      this.centerMessage.appendChild(subEl);
    }
    this.centerMessage.classList.add('visible');
  }

  hideMessage() {
    this.centerMessage.classList.remove('visible');
  }

  showAimHint(visible: boolean) {
    this.aimHint.style.opacity = visible ? '1' : '0';
  }

  setClub(name: string, maxDist: number) {
    this.clubEl.textContent = `${name}  \u2014  ${maxDist}m`;
  }

  setWind(directionDeg: number, speedMPH: number) {
    this.windArrow.style.transform = `rotate(${directionDeg}deg)`;
    this.windSpeed.textContent = `${speedMPH} mph`;
    const opacity = Math.min(1, speedMPH / 15);
    this.windEl.style.opacity = String(Math.max(0.3, opacity));
  }

  setSpin(label: string) {
    this.spinEl.textContent = label;
  }

  setTurnBanner(text: string, color?: string) {
    this.turnBanner.textContent = text;
    this.turnBanner.style.borderColor = color ?? 'rgba(255,255,255,0.5)';
    this.turnBanner.classList.add('visible');
    setTimeout(() => this.turnBanner.classList.remove('visible'), 2000);
  }

  hideTurnBanner() {
    this.turnBanner.classList.remove('visible');
  }

  showAutoClubHint(clubName: string) {
    this.autoClubHint.textContent = `Auto-switched to ${clubName}`;
    this.autoClubHint.classList.add('visible');
    setTimeout(() => this.autoClubHint.classList.remove('visible'), 2000);
  }

  setScorecard(scores: { hole: string; strokes: number; par: number }[]) {
    if (scores.length <= 3) {
      const parts = scores.map((s) => {
        const diff = s.strokes - s.par;
        const label = diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`);
        return `${s.hole}: ${s.strokes} (${label})`;
      });
      this.scorecardEl.textContent = parts.join('  |  ');
    } else {
      // Scrollable scorecard for more holes
      let html = '<div class="scorecard-scroll">';
      let totalStrokes = 0;
      let totalPar = 0;
      for (const s of scores) {
        const diff = s.strokes - s.par;
        const label = diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`);
        html += `<span>${s.hole}: ${s.strokes}(${label})</span> `;
        totalStrokes += s.strokes;
        totalPar += s.par;
      }
      const totalDiff = totalStrokes - totalPar;
      const totalLabel = totalDiff === 0 ? 'E' : (totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`);
      html += `<br><strong>Total: ${totalStrokes} (${totalLabel})</strong>`;
      html += '</div>';
      this.scorecardEl.innerHTML = html;
    }
  }

  setMultiplayerScorecard(players: { name: string; scores: number[]; color: number }[], pars: number[]) {
    this.scorecardEl.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'mp-scorecard';

    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th'));
    for (let i = 0; i < pars.length; i++) {
      const th = document.createElement('th');
      th.textContent = `H${i + 1}`;
      headerRow.appendChild(th);
    }
    const totalHeader = document.createElement('th');
    totalHeader.textContent = 'Tot';
    headerRow.appendChild(totalHeader);
    table.appendChild(headerRow);

    for (const p of players) {
      const row = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.style.color = '#' + p.color.toString(16).padStart(6, '0');
      nameCell.textContent = p.name;
      row.appendChild(nameCell);

      let total = 0;
      for (let i = 0; i < pars.length; i++) {
        const s = p.scores[i];
        const scoreCell = document.createElement('td');
        if (s !== undefined) {
          total += s;
          scoreCell.textContent = String(s);
        } else {
          scoreCell.textContent = '-';
        }
        row.appendChild(scoreCell);
      }

      const totalCell = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = total > 0 ? String(total) : '-';
      totalCell.appendChild(strong);
      row.appendChild(totalCell);
      table.appendChild(row);
    }

    this.scorecardEl.appendChild(table);
  }

  setSponsor(text: string) {
    this.sponsorEl.innerHTML = text;
  }

  showHoleSelect(holes: HoleOption[]) {
    this.holeSelectOverlay.innerHTML = '';
    this.holeSelectOverlay.classList.add('visible');

    const title = document.createElement('div');
    title.className = 'hole-select-title';
    title.textContent = 'Select a Hole';
    this.holeSelectOverlay.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'hole-select-grid';

    for (const hole of holes) {
      const card = document.createElement('button');
      card.className = 'hole-card';

      const name = document.createElement('div');
      name.className = 'hole-card-name';
      name.textContent = hole.name;

      const par = document.createElement('div');
      par.className = 'hole-card-par';
      par.textContent = `Par ${hole.par}`;

      card.appendChild(name);
      card.appendChild(par);

      if (hole.best !== undefined) {
        const best = document.createElement('div');
        best.className = 'hole-card-best';
        best.textContent = `Best: ${hole.best}`;
        card.appendChild(best);
      }

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideHoleSelect();
        this.onHoleSelect?.(hole.path);
      });

      grid.appendChild(card);
    }

    this.holeSelectOverlay.appendChild(grid);

    // Driving Range button
    const rangeBtn = document.createElement('button');
    rangeBtn.className = 'hole-card';
    rangeBtn.style.marginTop = '16px';
    rangeBtn.innerHTML = '<div class="hole-card-name">Driving Range</div><div class="hole-card-par">Practice Mode</div>';
    rangeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideHoleSelect();
      this.onRangeSelect?.();
    });
    this.holeSelectOverlay.appendChild(rangeBtn);

    // Multiplayer button
    const mpBtn = document.createElement('button');
    mpBtn.className = 'hole-card';
    mpBtn.style.marginTop = '16px';
    mpBtn.innerHTML = '<div class="hole-card-name">Multiplayer</div><div class="hole-card-par">2-4 Players</div>';
    mpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideHoleSelect();
      this.showMultiplayerSetup();
    });
    this.holeSelectOverlay.appendChild(mpBtn);
  }

  hideHoleSelect() {
    this.holeSelectOverlay.classList.remove('visible');
  }

  showMultiplayerSetup() {
    this.multiplayerSetupOverlay.innerHTML = '';
    this.multiplayerSetupOverlay.classList.add('visible');

    const title = document.createElement('div');
    title.className = 'hole-select-title';
    title.textContent = 'Multiplayer Setup';
    this.multiplayerSetupOverlay.appendChild(title);

    const form = document.createElement('div');
    form.className = 'mp-setup';

    const countLabel = document.createElement('div');
    countLabel.className = 'mp-label';
    countLabel.textContent = 'Number of Players:';
    form.appendChild(countLabel);

    const countRow = document.createElement('div');
    countRow.className = 'mp-count-row';
    let playerCount = 2;
    const inputs: HTMLInputElement[] = [];

    const inputsContainer = document.createElement('div');
    inputsContainer.className = 'mp-inputs';

    const updateInputs = () => {
      inputsContainer.innerHTML = '';
      inputs.length = 0;
      for (let i = 0; i < playerCount; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Player ${i + 1}`;
        input.value = `Player ${i + 1}`;
        input.className = 'mp-name-input';
        inputs.push(input);
        inputsContainer.appendChild(input);
      }
    };

    for (let n = 2; n <= 4; n++) {
      const btn = document.createElement('button');
      btn.className = 'club-btn';
      btn.textContent = String(n);
      btn.style.pointerEvents = 'auto';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playerCount = n;
        countRow.querySelectorAll('.club-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateInputs();
      });
      if (n === 2) btn.classList.add('active');
      countRow.appendChild(btn);
    }

    form.appendChild(countRow);
    form.appendChild(inputsContainer);
    updateInputs();

    const startBtn = document.createElement('button');
    startBtn.className = 'hole-card';
    startBtn.style.marginTop = '16px';
    startBtn.innerHTML = '<div class="hole-card-name">Start Game</div>';
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const names = inputs.map(i => i.value || i.placeholder);
      this.multiplayerSetupOverlay.classList.remove('visible');
      this.onMultiplayerSetup?.(names);
    });
    form.appendChild(startBtn);

    const backBtn = document.createElement('button');
    backBtn.className = 'hole-card';
    backBtn.style.marginTop = '8px';
    backBtn.innerHTML = '<div class="hole-card-name">Back</div>';
    backBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.multiplayerSetupOverlay.classList.remove('visible');
      this.onSinglePlayer?.();
    });
    form.appendChild(backBtn);

    this.multiplayerSetupOverlay.appendChild(form);
  }

  showRoundSummary(
    scores: { hole: string; strokes: number; par: number }[],
    personalBestTotal?: number,
    multiplayerData?: { name: string; scores: number[]; color: number }[]
  ) {
    this.roundSummaryOverlay.innerHTML = '';
    this.roundSummaryOverlay.classList.add('visible');

    const title = document.createElement('div');
    title.className = 'hole-select-title';
    title.textContent = 'Round Complete!';
    this.roundSummaryOverlay.appendChild(title);

    const table = document.createElement('div');
    table.className = 'round-summary';

    if (multiplayerData && multiplayerData.length > 0) {
      const summaryTable = document.createElement('table');
      summaryTable.className = 'summary-table';

      const headerRow = document.createElement('tr');
      const holeTh = document.createElement('th');
      holeTh.textContent = 'Hole';
      headerRow.appendChild(holeTh);
      const parTh = document.createElement('th');
      parTh.textContent = 'Par';
      headerRow.appendChild(parTh);
      for (const p of multiplayerData) {
        const th = document.createElement('th');
        th.style.color = '#' + p.color.toString(16).padStart(6, '0');
        th.textContent = p.name;
        headerRow.appendChild(th);
      }
      summaryTable.appendChild(headerRow);

      for (let i = 0; i < scores.length; i++) {
        const row = document.createElement('tr');
        const holeCell = document.createElement('td');
        holeCell.textContent = scores[i].hole;
        row.appendChild(holeCell);
        const parCell = document.createElement('td');
        parCell.textContent = String(scores[i].par);
        row.appendChild(parCell);
        for (const p of multiplayerData) {
          const cell = document.createElement('td');
          const shotCount = p.scores[i];
          cell.textContent = shotCount === undefined ? '-' : String(shotCount);
          row.appendChild(cell);
        }
        summaryTable.appendChild(row);
      }

      const totalRow = document.createElement('tr');
      totalRow.className = 'total-row';
      const totalHoleCell = document.createElement('td');
      const totalHoleStrong = document.createElement('strong');
      totalHoleStrong.textContent = 'Total';
      totalHoleCell.appendChild(totalHoleStrong);
      totalRow.appendChild(totalHoleCell);

      const totalParCell = document.createElement('td');
      const totalParStrong = document.createElement('strong');
      totalParStrong.textContent = String(scores.reduce((a, s) => a + s.par, 0));
      totalParCell.appendChild(totalParStrong);
      totalRow.appendChild(totalParCell);

      for (const p of multiplayerData) {
        const totalCell = document.createElement('td');
        const totalStrong = document.createElement('strong');
        totalStrong.textContent = String(p.scores.reduce((a, b) => a + b, 0));
        totalCell.appendChild(totalStrong);
        totalRow.appendChild(totalCell);
      }
      summaryTable.appendChild(totalRow);
      table.appendChild(summaryTable);

      let bestTotal = Infinity;
      let winner = '';
      for (const p of multiplayerData) {
        const total = p.scores.reduce((a, b) => a + b, 0);
        if (total < bestTotal) {
          bestTotal = total;
          winner = p.name;
        }
      }
      const winnerText = document.createElement('div');
      winnerText.className = 'winner-text';
      winnerText.textContent = `${winner} wins!`;
      table.appendChild(winnerText);
    } else {
      // Single player summary
      let html = '<table class="summary-table"><tr><th>Hole</th><th>Par</th><th>Score</th><th>+/-</th></tr>';
      let totalStrokes = 0;
      let totalPar = 0;
      for (const s of scores) {
        const diff = s.strokes - s.par;
        const label = diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`);
        html += `<tr><td>${s.hole}</td><td>${s.par}</td><td>${s.strokes}</td><td>${label}</td></tr>`;
        totalStrokes += s.strokes;
        totalPar += s.par;
      }
      const totalDiff = totalStrokes - totalPar;
      const totalLabel = totalDiff === 0 ? 'E' : (totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`);
      html += `<tr class="total-row"><td><strong>Total</strong></td><td><strong>${totalPar}</strong></td><td><strong>${totalStrokes}</strong></td><td><strong>${totalLabel}</strong></td></tr>`;
      html += '</table>';

      if (personalBestTotal !== undefined) {
        html += `<div class="pb-total">Personal Best: ${personalBestTotal}</div>`;
      }
      table.innerHTML = html;
    }

    this.roundSummaryOverlay.appendChild(table);

    const playAgainBtn = document.createElement('button');
    playAgainBtn.className = 'hole-card';
    playAgainBtn.style.marginTop = '16px';
    playAgainBtn.innerHTML = '<div class="hole-card-name">Play Again</div>';
    playAgainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.roundSummaryOverlay.classList.remove('visible');
      this.onSinglePlayer?.();
    });
    this.roundSummaryOverlay.appendChild(playAgainBtn);
  }

  hideRoundSummary() {
    this.roundSummaryOverlay.classList.remove('visible');
  }

  showRangeHUD(visible: boolean) {
    this.rangeHUD.classList.toggle('visible', visible);
  }

  updateRangeStats(stats: RangeStats) {
    const distText = stats.lastDistance > 0 ? `${stats.lastDistance}m` : '--m';
    const accuracyText = stats.lastAccuracy !== null ? `${stats.lastAccuracy}%` : '';
    const targetText = stats.targetHit !== null ? `Hit ${stats.targetHit}m target! ${accuracyText}` : '';

    this.rangeHUD.innerHTML = [
      `<div class="range-stat">Last: ${distText}</div>`,
      targetText ? `<div class="range-stat range-hit">${targetText}</div>` : '',
      `<div class="range-stat">Shots: ${stats.totalShots} | Targets Hit: ${stats.targetsHit}</div>`,
    ].join('');
  }
}
