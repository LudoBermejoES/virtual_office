import { describe, it, expect, vi } from "vitest";
import { placeAvatar, placeFallback } from "../../../src/render/avatar-mask.js";

interface InteractiveSpy {
  setInteractive: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  setStrokeStyle?: () => unknown;
  setOrigin?: () => unknown;
  destroy: () => void;
  emit?: (event: string) => void;
}

function makeScene(): {
  scene: unknown;
  created: InteractiveSpy[];
  textures: { exists: ReturnType<typeof vi.fn>; addCanvas: ReturnType<typeof vi.fn> };
} {
  const created: InteractiveSpy[] = [];

  const makeListenerObj = (): InteractiveSpy => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const obj: InteractiveSpy = {
      setInteractive: vi.fn().mockReturnThis(),
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        listeners[event] = listeners[event] ?? [];
        listeners[event].push(fn);
        return obj;
      }),
      setStrokeStyle: () => obj,
      setOrigin: () => obj,
      destroy: () => {},
      emit: (event: string) => {
        (listeners[event] ?? []).forEach((fn) => fn());
      },
    };
    created.push(obj);
    return obj;
  };

  // exists=true → saltea la rama de canvas que necesita DOM
  const textures = {
    exists: vi.fn().mockReturnValue(true),
    addCanvas: vi.fn(),
    get: vi.fn().mockReturnValue({ getSourceImage: () => ({}) }),
  };

  const scene = {
    add: {
      image: () => makeListenerObj(),
      circle: () => makeListenerObj(),
      text: () => makeListenerObj(),
    },
    textures,
  };

  return { scene, created, textures };
}

describe("placeAvatar", () => {
  it("sin onClick no llama a setInteractive", () => {
    const { scene, created } = makeScene();
    placeAvatar(scene as never, "avatar:1", 0, 0);
    const photo = created[0]!;
    expect(photo.setInteractive).not.toHaveBeenCalled();
  });

  it("con onClick registra setInteractive y el listener pointerdown", () => {
    const { scene, created } = makeScene();
    const onClick = vi.fn();
    placeAvatar(scene as never, "avatar:1", 0, 0, onClick);
    const photo = created[0]!;
    expect(photo.setInteractive).toHaveBeenCalledWith({ useHandCursor: true });
    expect(photo.on).toHaveBeenCalledWith("pointerdown", onClick);
  });

  it("emit('pointerdown') llama al onClick", () => {
    const { scene, created } = makeScene();
    const onClick = vi.fn();
    placeAvatar(scene as never, "avatar:1", 0, 0, onClick);
    const photo = created[0]!;
    photo.emit?.("pointerdown");
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("placeFallback", () => {
  it("sin onClick no llama a setInteractive", () => {
    const { scene, created } = makeScene();
    placeFallback(scene as never, 0, 0, { id: 1, name: "AB" });
    const circle = created[0]!;
    const text = created[1]!;
    expect(circle.setInteractive).not.toHaveBeenCalled();
    expect(text.setInteractive).not.toHaveBeenCalled();
  });

  it("con onClick registra interactive en círculo y texto", () => {
    const { scene, created } = makeScene();
    const onClick = vi.fn();
    placeFallback(scene as never, 0, 0, { id: 1, name: "AB" }, onClick);
    const circle = created[0]!;
    const text = created[1]!;
    expect(circle.setInteractive).toHaveBeenCalled();
    expect(circle.on).toHaveBeenCalledWith("pointerdown", onClick);
    expect(text.setInteractive).toHaveBeenCalled();
    expect(text.on).toHaveBeenCalledWith("pointerdown", onClick);
  });

  it("click en círculo y texto disparan onClick", () => {
    const { scene, created } = makeScene();
    const onClick = vi.fn();
    placeFallback(scene as never, 0, 0, { id: 1, name: "AB" }, onClick);
    const circle = created[0]!;
    const text = created[1]!;
    circle.emit?.("pointerdown");
    text.emit?.("pointerdown");
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
