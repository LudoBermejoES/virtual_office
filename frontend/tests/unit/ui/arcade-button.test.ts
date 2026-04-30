import { describe, it, expect, vi } from "vitest";

// Simula la API mínima de Phaser necesaria para arcadeButton
function makeScene() {
  const objects: { type: string; x: number; y: number; label?: string }[] = [];

  const makeText = (x: number, y: number, label: string) => {
    const obj = {
      type: "text",
      x,
      y,
      label,
      _originY: 0.5,
      setOrigin(ox: number, oy?: number) {
        this._originY = oy ?? ox;
        return this;
      },
      setScrollFactor() { return this; },
      setY(newY: number) { this.y = newY; return this; },
    };
    objects.push(obj);
    return obj;
  };

  const makeNineslice = (x: number, y: number) => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const obj = {
      type: "nineslice",
      x,
      y,
      setOrigin() { return this; },
      setInteractive() { return this; },
      on(event: string, fn: (...args: unknown[]) => void) {
        listeners[event] = listeners[event] ?? [];
        listeners[event].push(fn);
        return this;
      },
      emit(event: string, ...args: unknown[]) {
        (listeners[event] ?? []).forEach((fn) => fn(...args));
      },
    };
    objects.push(obj);
    return obj;
  };

  return {
    objects,
    add: {
      text: makeText,
      nineslice: (_x: number, _y: number, ..._rest: unknown[]) => makeNineslice(_x, _y),
    },
  };
}

describe("arcadeButton", async () => {
  const { arcadeButton } = await import("../../../src/ui/arcade-button.js");

  it("devuelve frame y text", () => {
    const scene = makeScene();
    const { frame, text } = arcadeButton(scene as never, 100, 50, "CLICK", () => {});
    expect(frame).toBeDefined();
    expect(text).toBeDefined();
  });

  it("el texto tiene el label correcto", () => {
    const scene = makeScene();
    const { text } = arcadeButton(scene as never, 100, 50, "OK", () => {});
    expect((text as { label?: string }).label).toBe("OK");
  });

  it("el texto baja 2px en pointerdown y sube en pointerup", () => {
    const scene = makeScene();
    const { frame, text } = arcadeButton(scene as never, 100, 50, "TEST", () => {});
    const initialY = (text as { y: number }).y;

    (frame as { emit: (e: string) => void }).emit("pointerdown");
    expect((text as { y: number }).y).toBe(initialY + 2);

    (frame as { emit: (e: string) => void }).emit("pointerup");
    expect((text as { y: number }).y).toBe(initialY);
  });

  it("onClick se llama en pointerup", () => {
    const scene = makeScene();
    const onClick = vi.fn();
    const { frame } = arcadeButton(scene as never, 100, 50, "BTN", onClick);
    (frame as { emit: (e: string) => void }).emit("pointerup");
    expect(onClick).toHaveBeenCalledOnce();
  });
});
