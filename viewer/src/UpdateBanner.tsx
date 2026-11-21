import type { UpdateBody } from "@pokemon-memory-reader/internal/update";
import { useCallback, useState } from "react";
import type { Polled } from "./useInternal";

export const DISMISSED_KEY = "pmr.update.dismissed";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

/** The version whose banner was dismissed, or null. A storage that throws counts as nothing saved. */
export function readDismissed(storage: Storage | null): string | null {
  try {
    return storage?.getItem(DISMISSED_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeDismissed(storage: Storage | null, version: string) {
  try {
    storage?.setItem(DISMISSED_KEY, version);
  } catch {
    // Private mode or a full quota: the banner comes back next load, which is harmless.
  }
}

/**
 * The newer release to announce, or null. Nothing shows with the check off, with no newer release,
 * or once that version was dismissed. A still newer release shows again (amendment 021, item 10).
 */
export function bannerRelease(
  update: UpdateBody | null,
  dismissed: string | null,
): { version: string; url: string } | null {
  if (update === null || !update.enabled || update.latest === null) return null;
  return update.latest.version === dismissed ? null : update.latest;
}

/** Only a web page link is followed, so a bad `url` from a release can't become a script link. */
export function safeReleaseUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

export function UpdateBannerView({
  update,
  dismissed,
  onDismiss,
}: {
  update: UpdateBody | null;
  dismissed: string | null;
  onDismiss: (version: string) => void;
}) {
  const release = bannerRelease(update, dismissed);
  if (release === null || update === null) return null;
  const href = safeReleaseUrl(release.url);
  return (
    <aside className="banner" role="status" aria-label="Update available">
      <p className="banner-text">
        Version {release.version} is available. You have {update.current}.
        {href ? (
          <>
            {" "}
            <a href={href} target="_blank" rel="noopener noreferrer">
              See the release
            </a>
          </>
        ) : null}
      </p>
      <button
        type="button"
        className="button button-quiet"
        onClick={() => onDismiss(release.version)}
      >
        Dismiss
      </button>
    </aside>
  );
}

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** The banner for the app, reading what `useUpdate` loaded. Dismissing is kept per version in localStorage. */
export function UpdateBanner({ update }: { update: Polled<UpdateBody> }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(storage()));
  const dismiss = useCallback((version: string) => {
    writeDismissed(storage(), version);
    setDismissed(version);
  }, []);
  return (
    <UpdateBannerView
      update={update.kind === "ready" ? update.value : null}
      dismissed={dismissed}
      onDismiss={dismiss}
    />
  );
}
