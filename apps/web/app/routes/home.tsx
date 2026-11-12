export function meta() {
  return [
    { title: "EXCELSIO 2.0 — Coming soon" },
    {
      name: "description",
      content:
        "EXCELSIO 2.0 — портфолио веб-разработчика и фотографа. Скоро: проекты, фотографии и визуальные эксперименты.",
    },
    { name: "robots", content: "noindex" },
  ];
}

/**
 * Временная главная страница (Этап 2A).
 * Дизайн, анимации, навигация и остальные разделы появятся на этапах 9–10.
 */
export default function Home() {
  return (
    <main className="home">
      <div className="home__mist" aria-hidden="true" />

      <div className="home__frame">
        <header className="home__brand">
          <h1 className="home__logo">EXCELSIO</h1>
          <p className="home__tagline">Code meets visual art.</p>
        </header>

        <p className="home__status">EXCELSIO 2.0 — Coming soon.</p>
      </div>
    </main>
  );
}
