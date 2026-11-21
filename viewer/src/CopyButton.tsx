import { useEffect, useState } from "react";
import { type CopyOutcome, copyText } from "./copy";

const RESET_MS = 2000;

/** A button that copies `text`, then says whether it worked for a moment. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [outcome, setOutcome] = useState<CopyOutcome | null>(null);
  useEffect(() => {
    if (outcome === null) return;
    const timer = setTimeout(() => setOutcome(null), RESET_MS);
    return () => clearTimeout(timer);
  }, [outcome]);
  return (
    <button
      type="button"
      className="button button-quiet"
      aria-label={label}
      onClick={() => void copyText(text).then(setOutcome)}
    >
      {outcome === "copied"
        ? "Copied"
        : outcome === "failed"
          ? "Copy failed, select the path"
          : "Copy"}
    </button>
  );
}
