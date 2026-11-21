import { describe, expect, test } from "bun:test";
import type { UpdateBody } from "@pokemon-memory-reader/internal/update";
import { renderToStaticMarkup } from "react-dom/server";
import {
  bannerRelease,
  DISMISSED_KEY,
  readDismissed,
  safeReleaseUrl,
  UpdateBannerView,
  writeDismissed,
} from "./UpdateBanner";

const newer: UpdateBody = {
  enabled: true,
  current: "2.0.0",
  latest: {
    version: "2.1.0",
    url: "https://github.com/atendev/pokemon-memory-reader/releases/tag/v2.1.0",
  },
  checkedAt: "2026-11-21T10:00:00Z",
};
const current = { ...newer, latest: null };

const view = (update: UpdateBody | null, dismissed: string | null = null) =>
  renderToStaticMarkup(
    <UpdateBannerView
      update={update}
      dismissed={dismissed}
      onDismiss={() => {}}
    />,
  );

describe("the update banner", () => {
  test("announces a newer release with its version, yours and a link", () => {
    const html = view(newer);
    expect(html).toContain("Version 2.1.0 is available. You have 2.0.0.");
    expect(html).toContain(
      'href="https://github.com/atendev/pokemon-memory-reader/releases/tag/v2.1.0"',
    );
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Dismiss");
  });

  test("is absent when there is no newer release", () => {
    expect(view(current)).toBe("");
  });

  test("is absent with the check off, before any answer, and when /update failed", () => {
    expect(view({ ...newer, enabled: false, latest: null })).toBe("");
    expect(view(null)).toBe("");
  });

  test("a dismissed version stays hidden and a still newer one shows again", () => {
    expect(view(newer, "2.1.0")).toBe("");
    expect(view(newer, "2.0.5")).toContain("Version 2.1.0");
    expect(bannerRelease(newer, "2.1.0")).toBeNull();
  });

  test("leaves out a link that isn't a web page", () => {
    const html = view({
      ...newer,
      latest: { version: "2.1.0", url: "javascript:alert(1)" },
    });
    expect(html).toContain("Version 2.1.0 is available");
    expect(html).not.toContain("javascript:");
    expect(safeReleaseUrl("javascript:alert(1)")).toBeNull();
    expect(safeReleaseUrl("not a url")).toBeNull();
  });
});

describe("the saved dismissal", () => {
  const store = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
  };

  test("is kept per version and read back", () => {
    const storage = store();
    expect(readDismissed(storage)).toBeNull();
    writeDismissed(storage, "2.1.0");
    expect(storage.getItem(DISMISSED_KEY)).toBe("2.1.0");
    expect(readDismissed(storage)).toBe("2.1.0");
  });

  test("a storage that throws or is missing doesn't break it", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readDismissed(broken)).toBeNull();
    expect(() => writeDismissed(broken, "2.1.0")).not.toThrow();
    expect(readDismissed(null)).toBeNull();
    expect(() => writeDismissed(null, "2.1.0")).not.toThrow();
  });
});
