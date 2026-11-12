import { type RouteConfig, index } from "@react-router/dev/routes";

/**
 * Явная конфигурация маршрутов (не flat-routes): для проекта такого размера
 * один файл читается быстрее, чем дерево каталогов.
 *
 * Этап 2A: только главная-заглушка. Остальные маршруты
 * (`development`, `photography`, `about`, `contact`, `admin`) добавляются
 * на последующих этапах согласно docs/ARCHITECTURE.md, §4.
 */
export default [index("routes/home.tsx")] satisfies RouteConfig;
