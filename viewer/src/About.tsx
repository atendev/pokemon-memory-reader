import type { AboutBody } from "@pokemon-memory-reader/internal/about";
import type { UpdateBody } from "@pokemon-memory-reader/internal/update";
import { joinNames, LGPL_COMPONENTS } from "./lgpl";
import { safeReleaseUrl } from "./UpdateBanner";
import type { Polled } from "./useInternal";

const NOTICES_PATH = "/about/third-party-notices.txt";
const LOADING = { kind: "loading" } as const;

/** The run-time copyright display for the LGPL libraries linked into the executable (amendment 042 §5). */
export function LgplNotice() {
  const names = joinNames(LGPL_COMPONENTS.map((c) => c.displayName));
  return (
    <section className="card" aria-labelledby="about-lgpl">
      <h2 className="headline" id="about-lgpl">
        Open-source libraries
      </h2>
      <p className="body">
        This program includes {names}, used under the GNU LGPL. See{" "}
        <a href={NOTICES_PATH}>third-party notices</a> for the licenses, source
        and relinking steps.
      </p>
      <ul className="footnote muted">
        {LGPL_COMPONENTS.map((c) => (
          <li key={c.displayName}>
            {c.displayName}: {c.copyright}
          </li>
        ))}
      </ul>
    </section>
  );
}

function VersionCard({ about }: { about: Polled<AboutBody> }) {
  return (
    <section className="card" aria-labelledby="about-version">
      <h2 className="headline" id="about-version">
        Version
      </h2>
      {about.kind === "loading" ? (
        <p className="body muted">Reading the version.</p>
      ) : about.kind === "unavailable" ? (
        <p className="body muted" role="alert">
          The version can't be read right now. {about.message}
        </p>
      ) : (
        <>
          <p className="body tabular">{about.value.versionLine}</p>
          <p className="footnote muted">
            Build: {about.value.target}, commit {about.value.commit}
          </p>
          {about.value.notices ? null : (
            <p className="footnote muted">
              Third-party notices ship with release builds.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** What the last update check found, in a sentence. Never a live call: `/update` serves the last check. */
export function updateSummary(update: UpdateBody): string {
  if (!update.enabled)
    return "Update checks are off. Turn them on in Settings.";
  if (update.latest !== null)
    return `Version ${update.latest.version} is available. You have ${update.current}.`;
  return update.checkedAt === null
    ? `You have ${update.current}. No update check has finished yet.`
    : `You have ${update.current}, the newest release as of ${new Date(update.checkedAt).toLocaleString()}.`;
}

function UpdateCard({ update }: { update: Polled<UpdateBody> }) {
  const release =
    update.kind === "ready" && update.value.latest !== null
      ? safeReleaseUrl(update.value.latest.url)
      : null;
  return (
    <section className="card" aria-labelledby="about-update">
      <h2 className="headline" id="about-update">
        Updates
      </h2>
      {update.kind === "loading" ? (
        <p className="body muted">Reading the last update check.</p>
      ) : update.kind === "unavailable" ? (
        <p className="body muted" role="alert">
          The last update check can't be read right now. {update.message}
        </p>
      ) : (
        <p className="body">
          {updateSummary(update.value)}
          {release ? (
            <>
              {" "}
              <a href={release} target="_blank" rel="noopener noreferrer">
                See the release
              </a>
            </>
          ) : null}
        </p>
      )}
    </section>
  );
}

export function About({
  about = LOADING,
  update = LOADING,
}: {
  about?: Polled<AboutBody>;
  update?: Polled<UpdateBody>;
}) {
  return (
    <div className="stack">
      <h2 className="title-1">About</h2>
      <VersionCard about={about} />
      <UpdateCard update={update} />
      <LgplNotice />
    </div>
  );
}
