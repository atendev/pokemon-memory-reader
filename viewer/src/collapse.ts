import { useState } from "react";

export const COLLAPSE_KEY = "pmr.sidebarCollapsed";

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

/** The saved sidebar state. Missing, unreadable or unknown values leave the sidebar expanded. */
export function readCollapsed(storage: Reader | null): boolean {
  try {
    return storage?.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Saving is best effort: a blocked or full store only means the next load starts expanded. */
export function writeCollapsed(storage: Writer | null, collapsed: boolean) {
  try {
    storage?.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {}
}

/** The state after a toggle, saved so the next load restores it. */
export function toggleCollapsed(
  storage: Writer | null,
  collapsed: boolean,
): boolean {
  const next = !collapsed;
  writeCollapsed(storage, next);
  return next;
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The sidebar's collapsed state, restored from `localStorage` on load and saved on every toggle. */
export function useSidebarCollapsed(): readonly [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() =>
    readCollapsed(browserStorage()),
  );
  const toggle = () =>
    setCollapsed(toggleCollapsed(browserStorage(), collapsed));
  return [collapsed, toggle] as const;
}
