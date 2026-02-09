export class PauseMenu {
  private overlay: HTMLElement;
  private visible = false;

  onResume?: () => void;
  onRestartHole?: () => void;
  onHoleSelect?: () => void;

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'pause-overlay';
    this.build();
    container.appendChild(this.overlay);
  }

  private build() {
    const menu = document.createElement('div');
    menu.className = 'pause-menu';

    const title = document.createElement('div');
    title.className = 'pause-title';
    title.textContent = 'PAUSED';
    menu.appendChild(title);

    const buttons: { label: string; action: () => void }[] = [
      { label: 'Resume', action: () => this.onResume?.() },
      { label: 'Restart Hole', action: () => this.onRestartHole?.() },
      { label: 'Hole Select', action: () => this.onHoleSelect?.() },
    ];

    for (const btn of buttons) {
      const el = document.createElement('button');
      el.className = 'pause-btn';
      el.textContent = btn.label;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.action();
      });
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.action();
      });
      menu.appendChild(el);
    }

    // Controls reference
    const controls = document.createElement('div');
    controls.className = 'pause-controls';
    controls.innerHTML = [
      '<strong>Controls</strong>',
      'A/D or Drag — Aim',
      'Q/E — Change Club',
      'Z/C — Spin',
      'SPACE — Charge & Shoot',
      'Scroll — Adjust View',
      'ESC — Pause',
    ].join('<br>');
    menu.appendChild(controls);

    this.overlay.appendChild(menu);
  }

  show() {
    this.visible = true;
    this.overlay.classList.add('visible');
  }

  hide() {
    this.visible = false;
    this.overlay.classList.remove('visible');
  }

  isVisible(): boolean {
    return this.visible;
  }
}
