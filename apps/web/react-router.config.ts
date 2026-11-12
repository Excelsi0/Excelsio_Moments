import type { Config } from "@react-router/dev/config";

/**
 * Конфигурация React Router Framework Mode.
 * SSR включён по умолчанию (D-016): публичные страницы отдаются готовым HTML.
 * Статические маршруты можно будет пререндерить на сборке (`prerender`) на этапе SEO.
 */
export default {
  ssr: true,
} satisfies Config;
