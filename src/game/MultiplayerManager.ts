import * as THREE from 'three';

export interface PlayerData {
  name: string;
  color: number;
  scores: number[]; // strokes per hole
  ballPosition: THREE.Vector3;
  holedOut: boolean;
  shotCount: number;
}

const PLAYER_COLORS = [0xffffff, 0xff6666, 0x66ff66, 0x6666ff];

export class MultiplayerManager {
  players: PlayerData[] = [];
  currentPlayerIndex = 0;
  enabled = false;

  private sanitizeName(name: string, fallback: string): string {
    const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, 24);
    const safe = trimmed.replace(/[<>"'&]/g, '');
    return safe.length > 0 ? safe : fallback;
  }

  setup(names: string[]) {
    this.players = names.map((name, i) => ({
      name: this.sanitizeName(name, `Player ${i + 1}`),
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      scores: [],
      ballPosition: new THREE.Vector3(),
      holedOut: false,
      shotCount: 0,
    }));
    this.currentPlayerIndex = 0;
    this.enabled = true;
  }

  getCurrentPlayer(): PlayerData | null {
    if (!this.enabled || this.players.length === 0) return null;
    return this.players[this.currentPlayerIndex];
  }

  saveBallPosition(pos: THREE.Vector3) {
    const player = this.getCurrentPlayer();
    if (player) {
      player.ballPosition.copy(pos);
    }
  }

  incrementShot() {
    const player = this.getCurrentPlayer();
    if (player) {
      player.shotCount++;
    }
  }

  markHoledOut() {
    const player = this.getCurrentPlayer();
    if (player) {
      player.holedOut = true;
      player.scores.push(player.shotCount);
    }
  }

  allHoledOut(): boolean {
    return this.players.every(p => p.holedOut);
  }

  nextPlayer(): PlayerData | null {
    if (!this.enabled) return null;

    // Find next player who hasn't holed out
    for (let i = 1; i <= this.players.length; i++) {
      const idx = (this.currentPlayerIndex + i) % this.players.length;
      if (!this.players[idx].holedOut) {
        this.currentPlayerIndex = idx;
        return this.players[idx];
      }
    }
    return null;
  }

  startNewHole(teePosition: THREE.Vector3) {
    for (const player of this.players) {
      player.holedOut = false;
      player.shotCount = 0;
      player.ballPosition.copy(teePosition);
    }
    this.currentPlayerIndex = 0;
  }

  getTotalScore(playerIndex: number): number {
    return this.players[playerIndex].scores.reduce((a, b) => a + b, 0);
  }

  getWinner(): PlayerData | null {
    if (this.players.length === 0) return null;
    let best = this.players[0];
    let bestScore = this.getTotalScore(0);
    for (let i = 1; i < this.players.length; i++) {
      const score = this.getTotalScore(i);
      if (score < bestScore) {
        best = this.players[i];
        bestScore = score;
      }
    }
    return best;
  }

  reset() {
    this.players = [];
    this.currentPlayerIndex = 0;
    this.enabled = false;
  }
}
