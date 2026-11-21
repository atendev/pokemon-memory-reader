/** Stands in for a screen whose ticket hasn't landed. */
export function Placeholder({ title }: { title: string }) {
  return (
    <section className="empty" aria-labelledby="placeholder-title">
      <h2 id="placeholder-title" className="title-1">
        {title}
      </h2>
      <p className="body muted">This screen isn't built yet.</p>
    </section>
  );
}
