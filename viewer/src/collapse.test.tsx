import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App";
import {
  COLLAPSE_KEY,
  readCollapsed,
  toggleCollapsed,
  writeCollapsed,
} from "./collapse";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("the saved sidebar state", () => {
  test("starts expanded with nothing saved or no storage", () => {
    expect(readCollapsed(fakeStorage())).toBe(false);
    expect(readCollapsed(null)).toBe(false);
  });

  test("a collapse is restored on the next read, and so is an expand", () => {
    const storage = fakeStorage();
    writeCollapsed(storage, true);
    expect(readCollapsed(storage)).toBe(true);
    writeCollapsed(storage, false);
    expect(readCollapsed(storage)).toBe(false);
  });

  test("an unknown saved value leaves the sidebar expanded", () => {
    expect(readCollapsed(fakeStorage({ [COLLAPSE_KEY]: "maybe" }))).toBe(false);
  });

  test("a storage that throws doesn't break reading or writing", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readCollapsed(broken)).toBe(false);
    expect(() => writeCollapsed(broken, true)).not.toThrow();
  });
});

describe("toggling the sidebar", () => {
  test("flips the state and saves it, so a reload restores the same state", () => {
    const storage = fakeStorage();
    expect(toggleCollapsed(storage, false)).toBe(true);
    expect(readCollapsed(storage)).toBe(true);
    expect(toggleCollapsed(storage, true)).toBe(false);
    expect(readCollapsed(storage)).toBe(false);
  });

  test("still flips the state when nothing can be saved", () => {
    expect(toggleCollapsed(null, false)).toBe(true);
  });
});

describe("the app on load", () => {
  const html = (stored: string | null) => {
    const store = {
      getItem: () => stored,
      setItem: () => {},
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: store },
      configurable: true,
    });
    try {
      return renderToStaticMarkup(<App />);
    } finally {
      if (previous) Object.defineProperty(globalThis, "window", previous);
      else Reflect.deleteProperty(globalThis, "window");
    }
  };

  test("renders the shell with the sidebar and the Party link", () => {
    const page = html(null);
    expect(page).toContain('class="shell"');
    expect(page).toContain('href="#/party"');
    expect(page).toContain('aria-expanded="true"');
  });

  test("restores a collapsed sidebar from storage", () => {
    const page = html("1");
    expect(page).toContain("shell shell-collapsed");
    expect(page).toContain('aria-expanded="false"');
  });
});
