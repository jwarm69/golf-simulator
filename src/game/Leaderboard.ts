import { LeaderboardEntry } from '../types';

const STORAGE_KEY = 'golf_sim_leaderboard';

export class Leaderboard {
  private entries: LeaderboardEntry[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.entries = JSON.parse(raw);
      }
    } catch {
      this.entries = [];
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // localStorage full or unavailable
    }
  }

  saveRound(entry: LeaderboardEntry) {
    this.entries.push(entry);
    // Sort by relative score (totalStrokes - totalPar), then by date
    this.entries.sort((a, b) => {
      const relA = a.totalStrokes - a.totalPar;
      const relB = b.totalStrokes - b.totalPar;
      if (relA !== relB) return relA - relB;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    // Keep top 50
    if (this.entries.length > 50) {
      this.entries = this.entries.slice(0, 50);
    }
    this.save();
  }

  getTopEntries(count: number): LeaderboardEntry[] {
    return this.entries.slice(0, count);
  }

  getBestRound(): LeaderboardEntry | null {
    return this.entries.length > 0 ? this.entries[0] : null;
  }

  getTodayEntries(): LeaderboardEntry[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.entries.filter(e => e.date.slice(0, 10) === today);
  }

  getWeekEntries(): LeaderboardEntry[] {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return this.entries.filter(e => new Date(e.date) >= weekAgo);
  }

  clearAll() {
    this.entries = [];
    this.save();
  }
}
