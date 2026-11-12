import { useRef } from "react";

import { usePointerParallax } from "~/lib/usePointerParallax";
import "~/styles/hero.scss";

export function meta() {
  return [
    { title: "EXCELSIO — Code meets visual art" },
    {
      name: "description",
      content:
        "EXCELSIO — цифровое портфолио на стыке веб-разработки и фотографии: проекты, визуальные эксперименты, авторские кадры.",
    },
    // До публичного релиза страница закрыта от индексации.
    { name: "robots", content: "noindex" },
  ];
}

/**
 * Первый экран (Этап 2D).
 * Объект собран из CSS-слоёв и инлайн-SVG: без WebGL и сторонних библиотек.
 * Параллакс пишет CSS-переменные напрямую в DOM — React не перерисовывается.
 */
export default function Home() {
  const sculptureRef = useRef<HTMLDivElement | null>(null);
  usePointerParallax(sculptureRef, { strengthX: 0.85, strengthY: 0.85, damping: 0.09 });

  return (
    <main className="hero">
      <div className="hero__atmosphere" aria-hidden="true">
        <span className="hero__glow hero__glow--violet" />
        <span className="hero__glow hero__glow--blue" />
        <span className="hero__glow hero__glow--coral" />
      </div>

      <header className="hero__header">
        <a className="hero__brand" href="/" aria-label="EXCELSIO — на главную">
          <span className="hero__brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation">
              <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />
            </svg>
          </span>
          <span className="hero__brand-text">EXCELSIO</span>
        </a>

        <p className="hero__edition">
          <span>v2.0</span>
          <span aria-hidden="true">/</span>
          <span>2026</span>
        </p>
      </header>

      <div className="hero__stage">
        <div className="hero__sculpture" ref={sculptureRef} aria-hidden="true">
          <span className="hero__aura" />

          <span className="hero__glass">
            <span className="hero__core hero__core--violet" />
            <span className="hero__core hero__core--blue" />
            <span className="hero__core hero__core--coral" />
            <span className="hero__sheen hero__sheen--a" />
            <span className="hero__sheen hero__sheen--b" />
            <span className="hero__rim" />
          </span>

          <svg className="hero__contour" viewBox="0 0 320 320" role="presentation">
            <defs>
              <linearGradient id="heroContourViolet" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                <stop offset="45%" stopColor="#8b5cf6" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.35" />
              </linearGradient>
              <linearGradient id="heroContourCoral" x1="1" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#ff6b5b" stopOpacity="0.8" />
                <stop offset="70%" stopColor="#ff9b8f" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#ff9b8f" stopOpacity="0" />
              </linearGradient>
            </defs>

            <g fill="none" stroke="url(#heroContourViolet)">
              <ellipse cx="160" cy="160" rx="129" ry="126" transform="rotate(-18 160 160)" strokeWidth="1.1" />
              <ellipse
                cx="160"
                cy="160"
                rx="106"
                ry="118"
                transform="rotate(-13 160 160)"
                strokeWidth="0.9"
                opacity="0.72"
              />
              <ellipse
                cx="160"
                cy="160"
                rx="80"
                ry="98"
                transform="rotate(-7 160 160)"
                strokeWidth="0.8"
                opacity="0.5"
              />
              <ellipse
                cx="160"
                cy="160"
                rx="52"
                ry="72"
                transform="rotate(-2 160 160)"
                strokeWidth="0.7"
                opacity="0.34"
              />
            </g>

            <path
              d="M78 232c26 18 66 26 106 16 41-10 72-38 88-74"
              fill="none"
              stroke="url(#heroContourCoral)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="hero__type">
          <h1 className="hero__title">
            <span className="hero__title-ghost" aria-hidden="true">
              EXCELSIO
            </span>
            <span className="hero__title-fill">EXCELSIO</span>
          </h1>

          <p className="hero__tagline">
            <span className="hero__tagline-rule" aria-hidden="true" />
            Code meets visual art.
          </p>
        </div>
      </div>

      <footer className="hero__footer">
        <p className="hero__meta">
          <span>Portfolio</span>
          <span className="hero__meta-dot" aria-hidden="true" />
          <span>Kazan</span>
        </p>

        <p className="hero__scroll" aria-hidden="true">
          <span className="hero__scroll-label">scroll</span>
          <span className="hero__scroll-line" />
        </p>
      </footer>

      <div className="hero__grain" aria-hidden="true" />
    </main>
  );
}
