const STORAGE_KEY = "vo_sound_muted";

class SoundManager {
  private muted: boolean;
  private sounds: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    this.muted = saved === null ? true : saved === "true";
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggle(): void {
    this.muted = !this.muted;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(this.muted));
    }
  }

  play(name: "beep-click" | "beep-booked" | "beep-error"): void {
    if (this.muted || typeof Audio === "undefined") return;
    let audio = this.sounds.get(name);
    if (!audio) {
      audio = new Audio(`/assets/audio/${name}.wav`);
      audio.volume = 0.25;
      this.sounds.set(name, audio);
    }
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }
}

export const soundManager = new SoundManager();
