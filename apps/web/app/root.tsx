import type { ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import "./styles/tokens.css";
import "./styles/base.scss";

/**
 * Корневой layout: документ целиком (html/head/body) собирается здесь.
 * `Meta`, `Links`, `Scripts`, `ScrollRestoration` — обязательные элементы
 * React Router Framework Mode для SSR и гидратации.
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#08080b" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
