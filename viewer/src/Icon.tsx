import type { ScreenId } from "./routes";

const PATHS: Record<ScreenId | "about", string> = {
  party: "M4 5h6v6H4zM14 5h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  battle: "M5 5l14 14M19 5L5 19",
  boxes: "M4 8h16v12H4zM4 8l2-4h12l2 4M10 12h4",
  trainer: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 4-6 8-6s8 2 8 6",
  settings:
    "M4 8h9M17 8h3M4 16h3M11 16h9M15 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  about: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5",
};

/** A 24 px line icon for the sidebar. Decorative: the link's text or label names it. */
export function Icon({ name }: { name: ScreenId | "about" }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
