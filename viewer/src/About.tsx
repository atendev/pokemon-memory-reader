import { joinNames, LGPL_COMPONENTS } from "./lgpl";

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
        <a href="/about/third-party-notices.txt">third-party notices</a> for the
        licenses, source and relinking steps.
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

export function About() {
  return (
    <>
      <h2 className="title-1">About</h2>
      <LgplNotice />
    </>
  );
}
