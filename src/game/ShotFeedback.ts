import { ZoneType } from '../types';

export class ShotFeedback {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, gain: number, type: OscillatorType = 'sine') {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  private playNoise(duration: number, gain: number) {
    const ctx = this.getContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(g);
    g.connect(ctx.destination);
    source.start(ctx.currentTime);
  }

  onShotFired() {
    // Sharp click/thwack
    this.playTone(800, 0.08, 0.3, 'square');
    this.playTone(400, 0.12, 0.2, 'triangle');
    this.playNoise(0.06, 0.15);
    this.vibrate(30);
  }

  playLandingSound(zone: ZoneType) {
    switch (zone) {
      case 'green':
        this.playTone(600, 0.15, 0.2, 'sine');
        this.vibrate(15);
        break;
      case 'fairway':
        this.playTone(300, 0.2, 0.15, 'triangle');
        this.playNoise(0.1, 0.08);
        this.vibrate(20);
        break;
      case 'sand':
        this.playNoise(0.3, 0.2);
        this.vibrate(40);
        break;
      case 'rough':
        this.playTone(200, 0.15, 0.12, 'triangle');
        this.playNoise(0.15, 0.1);
        this.vibrate(25);
        break;
      case 'water':
        this.playTone(150, 0.4, 0.15, 'sine');
        this.playTone(100, 0.5, 0.1, 'sine');
        this.vibrate(50);
        break;
      default:
        this.playNoise(0.1, 0.08);
        this.vibrate(15);
    }
  }

  private vibrate(ms: number) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }
}
