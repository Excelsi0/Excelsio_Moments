# ARCHITECTURE — EXCELSIO 2.0

**Статус:** пересмотрено на Этапе 1.5. Новая архитектура — **предложение, ожидающее утверждения владельца**. До утверждения код не пишется.
**Связанные документы:** `REQUIREMENTS.md`, `TECH_STACK.md`, `DESIGN_SYSTEM.md`, `SECURITY.md`, `DECISIONS.md`, `ROADMAP.md`.

> **Что изменилось на Этапе 1.5.** Ручная связка «Fastify + Vite SSR + отдельный API» заменена на **React Router 7 Framework Mode** — один fullstack-приложение с серверными `loader`/`action`. Убраны npm workspaces и пакет `packages/shared`. БД переведена в **SQLite + Drizzle** (PostgreSQL — как путь роста). Медиа-конвейер упрощён. Первая версия сайта (`src/`) не затронута. Обоснования — ADR `D-016`…`D-022` в `DECISIONS.md`.

---

## 1. Принципы

1. **Одно приложение, один процесс, один деплой.** React Router Framework Mode: маршруты, серверные загрузчики, мутации и SSR — в одном проекте.
2. **Домен — в модулях, а не в слоях.** `app/server/*` содержит доменную логику; route-модули — только HTTP-обвязка (валидация → вызов сервиса → ответ/редирект).
3. **Формы и сервер — база, JS — усиление.** Мутации работают через нативные `<Form>`; без JavaScript админка остаётся работоспособной.
4. **Один контракт типов.** Zod-схемы в `app/lib/validation` используются и в `action`, и в UI; типы — через `z.infer`, а не ручные интерфейсы.
5. **Mobile-first и производительность.** SSR HTML, минимум клиентского JS, отсутствие админского кода в публичных чанках.
6. **Безопасность по умолчанию.** Приватные маршруты закрыты проверкой сессии на сервере, загрузки перекодируются, секреты — только в окружении.
7. **Один администратор.** Никаких ролей, приглашений и мультиарендности.

---

## 2. Рекомендуемая архитектура

```
                     ┌──────────────────────────────────────────────┐
   Браузер (mobile)  │  Caddy: HTTPS, gzip/brotli, статика, /media   │
   Браузер (desktop)─┤  (production: файлы изображений отдаёт Caddy)  │
                     └───────────────┬──────────────────────────────┘
                                     │ :3000
                     ┌───────────────▼──────────────────────────────┐
                     │  Node.js 24 LTS + React Router 7 (framework)  │
                     │                                              │
                     │  app/routes/*                                │
                     │   ├─ публичные route-модули (SSR + meta)      │
                     │   ├─ admin route-модули (сессия + действия)   │
                     │   └─ resource routes (/media, /sitemap.xml)   │
                     │                                              │
                     │  app/server/*                                │
                     │   ├─ db        (Drizzle + SQLite, миграции)   │
                     │   ├─ auth      (сессии, Argon2id, guard)      │
                     │   ├─ media     (sharp-конвейер, blurhash)     │
                     │   ├─ storage   (local сейчас, S3 позже)       │
                     │   ├─ notify    (Telegram, SMTP)               │
                     │   ├─ seo       (meta, sitemap, JSON-LD)       │
                     │   └─ security  (rate limit, origin-check)     │
                     └───────┬──────────────────────┬───────────────┘
                             │                      │
                   ┌─────────▼────────┐   ┌─────────▼─────────────┐
                   │ SQLite (WAL)     │   │ storage/ (медиа)      │
                   │ .data/app.sqlite │   │ локальный том → S3    │
                   └──────────────────┘   └───────────────────────┘
```

**Почему так.** React Router Framework Mode уже содержит то, что в первой версии архитектуры собиралось вручную: SSR, маршрутизацию с серверными `loader`/`action`, ревалидацию данных, cookie-сессии, resource routes для API/файлов, обработку форм с прогрессивным улучшением. Отдельный Fastify-сервер при этом становится лишним слоем.

---

## 3. Что исключено по сравнению с первой версией

| Было | Стало | Причина |
| --- | --- | --- |
| Fastify 5 + плагины (`cookie`, `multipart`, `rate-limit`, `static`) | Route-модули + `app/server/security` | Функциональность покрывается фреймворком и небольшими серверными модулями |
| Ручная интеграция Vite SSR (`entry-client`/`entry-server`) | Встроенный SSR React Router (`react-router.config.ts`, `ssr: true`) | Не нужно поддерживать свой SSR-мост |
| Отдельный REST API `/api/v1/*` | `loader`/`action` + несколько resource routes | Меньше контрактов, типы данных выводятся из загрузчиков |
| npm workspaces: `apps/web`, `apps/api`, `packages/shared` | Один пакет `apps/web/` | Нет реальной необходимости в монорепо |
| TanStack Query | Ревалидация React Router после `action` | Дублировало механизм фреймворка |
| react-hook-form | `<Form>` + серверная валидация Zod + `useNavigation` | Один источник валидации, работает без JS |
| PostgreSQL (обязательно) | SQLite (WAL) + Drizzle; PostgreSQL как путь роста | Один администратор, сотни записей |
| 18 вариантов изображения (6 ширин × 3 формата) | 6 вариантов + OG-производное | Достаточно для retina и мобильных экранов |
| pino-логи как обязательный слой | Структурированные логи процесса + ошибки в `ErrorBoundary` | Меньше зависимостей на старте |

**Сохранено без изменений:** дизайн-система и токены, mobile-first, a11y и `prefers-reduced-motion`, требования к безопасности загрузок и авторизации, SEO-требования, Telegram-уведомления, локальное хранилище медиа с переходом на S3, собственный VPS, GitHub как источник истины.

---

## 4. Карта маршрутов

Конфигурация маршрутов — явная, в `app/routes.ts` (не flat-routes: для проекта такого размера читаемее один файл).

### Публичные маршруты

| Путь | Модуль | Рендер | Назначение |
| --- | --- | --- | --- |
| `/` | `routes/_index.tsx` | SSR (+ опционально prerender) | Главная: hero, избранные проекты/фото |
| `/development` | `routes/development.tsx` | SSR, кэш 60 c | Каталог проектов, фильтры в query |
| `/development/:slug` | `routes/development.$slug.tsx` | SSR | Кейс, мета/OG из данных |
| `/photography` | `routes/photography.tsx` | SSR, кэш 60 c | Галерея, фильтр категорий |
| `/photography/:slug` | `routes/photography.$slug.tsx` | SSR | Опционально (решение Q9) |
| `/about` | `routes/about.tsx` | SSR (+ prerender) | О авторе |
| `/contact` | `routes/contact.tsx` | SSR + `action` | Форма заявки |
| `*` | `routes/$.tsx` | SSR | 404 с навигацией |

### Админка (сессия обязательна, `noindex`)

| Путь | Назначение |
| --- | --- |
| `/admin/login` | Вход (`action`: проверка пароля, создание сессии) |
| `/admin/logout` | `action`: отзыв сессии |
| `/admin` | Дашборд: счётчики, новые заявки |
| `/admin/projects`, `/admin/projects/:id` | CRUD проектов, обложка, галерея, блоки контента |
| `/admin/photos`, `/admin/photos/:id` | CRUD фотографий, мультизагрузка |
| `/admin/categories` | Категории проектов и фото |
| `/admin/applications`, `/admin/applications/:id` | Заявки, статусы |
| `/admin/settings` | Тексты/контакты/SEO по умолчанию |

Guard реализуется в layout-маршруте `admin.tsx`: `loader` проверяет сессию, без неё — `redirect('/admin/login?next=…')`; каждый дочерний `action` дополнительно проверяет сессию (не полагаться только на layout).

### Resource routes (не HTML)

| Путь | Что отдаёт |
| --- | --- |
| `/media/:hash/:variant` | Производные изображения (dev — через Node, prod — Caddy из каталога) |
| `/admin/media/:hash/original` | Оригинал (только с сессией) |
| `/sitemap.xml` | Sitemap из БД (только опубликованное) |
| `/robots.txt` | Правила, закрытие `/admin` |
| `/health` | Статус приложения и БД (без подробностей) |

---

## 5. Серверные модули (`app/server`)

| Модуль | Ответственность | Зависимости |
| --- | --- | --- |
| `db/client.ts` | Открытие SQLite (WAL, `busy_timeout`, `foreign_keys`), singleton в dev | driver |
| `db/schema.ts` | Drizzle-схема всех таблиц | — |
| `db/*.repo.ts` | Запросы по домену (`projects`, `photos`, `categories`, `applications`, `sessions`, `settings`) | `db/client` |
| `auth/session.ts` | Создание/чтение/отзыв сессии, cookie-флаги | `db`, `react-router` |
| `auth/password.ts` | Argon2id hash/verify, rehash при необходимости | `argon2` |
| `auth/guard.ts` | `requireAdmin(request)` — сессия + проверка `Origin`/`Sec-Fetch-Site` | `auth/session` |
| `media/process.ts` | Валидация формата, `sharp`-конвейер, blurhash, размеры | `sharp`, `blurhash` |
| `media/original.ts` | Приём файла, лимиты | `form-data-parser` |
| `storage/index.ts` | `put/get/delete/publicUrl`, реализации `local` и `s3` (позже) | `node:fs` |
| `notify/telegram.ts` | Отправка уведомления, 3 попытки, таймаут | `fetch` |
| `notify/mail.ts` | Резервный канал SMTP | `nodemailer` (этап 8) |
| `seo/meta.ts` | `meta()`-хелперы: title/description/OG/Twitter/JSON-LD | — |
| `seo/sitemap.ts` | Генерация XML из опубликованного контента | `db` |
| `security/rate-limit.ts` | In-memory лимитер (окно, ключ `ip+route`) | — |
| `security/csrf.ts` | Проверка `Origin`/`Sec-Fetch-Site` для не-GET | — |

Правило: route-модуль не содержит SQL и не вызывает `sharp` напрямую; серверные модули не импортируют React-компоненты и не попадают в клиентский бандл (файлы `.server.ts` либо импортируются только из `loader`/`action`).

---

## 6. Модель данных (SQLite + Drizzle)

Типы выбраны переносимыми (тот же набор полей можно выразить в PostgreSQL):

```
admin_users        id text pk · email text uniq · password_hash text · created_at int(ms) · last_login_at int
sessions           id text pk · user_id → admin_users · token_hash text uniq · expires_at int · created_at int
                   · revoked_at int null · ip_hash text · user_agent text
categories         id text pk · slug text · title text · kind text('project'|'photo') · sort_order int
                   · UNIQUE(kind, slug)
projects           id text pk · slug text uniq · title text · summary text · status text('draft'|'published'|'archived')
                   · featured int(bool) · year int · role text · client text · stack text(json array)
                   · links text(json) · blocks text(json) · cover_media_id → media · category_id → categories
                   · seo_title text · seo_description text · sort_order int · published_at int · created_at int · updated_at int
media              id text pk · storage_key text uniq · public_base text · width int · height int · bytes int
                   · format text · variants text(json) · blurhash text · alt text · created_at int
photos             id text pk · slug text uniq · title text · description text · category_id → categories
                   · media_id → media · status text · taken_at int null · location text · camera text
                   · sort_order int · published_at int · created_at int · updated_at int
project_media      project_id → projects · media_id → media · sort_order int · caption text null
applications       id text pk · name · contact · contact_type · topic null · message · status text
                   · page_url null · ip_hash · user_agent · created_at int · handled_at int null
settings           key text pk · value text(json) · updated_at int
redirects          from text pk · to text · created_at int      (301 при смене slug)
```

**Правила:**

- Идентификаторы — `text` (UUID v4/cuid2), чтобы не зависеть от поведения `AUTOINCREMENT` и упростить будущий перенос.
- Время — `integer` с `mode: 'timestamp_ms'` (никаких строковых дат в разных форматах).
- Массивы и блочный контент — `text` с `mode: 'json'` + Zod-валидация на границе.
- Slug неизменяем после публикации напрямую: смена создаёт запись в `redirects`.
- Черновики не попадают ни в публичные выборки, ни в sitemap.
- Внешние ключи включены (`PRAGMA foreign_keys = ON`), удаление — каскадное там, где это безопасно, иначе мягкое архивирование.
- Индексы: `projects(status, published_at)`, `projects(slug)`, `photos(status, sort_order)`, `photos(slug)`, `applications(status, created_at)`, `sessions(token_hash)`, `media(storage_key)`.

**Ограничения SQLite, которые принимаем осознанно:** один писатель за раз (для одного администратора — норма), отсутствие `timestamptz`/`jsonb`/полнотекстового поиска «из коробки» (FTS5 есть, но не в 2.0), бэкап — файловый. Подробнее и с условиями перехода на PostgreSQL — `TECH_STACK.md`, раздел «База данных».

---

## 7. Данные и мутации

### Поток чтения (SSR)

```
GET /development/my-case
  → route.loader({ params, request })
      → projects.getPublishedBySlug(slug)         (SQLite, Drizzle)
      → 404, если черновик/нет
  → loaderData → компонент + meta() с title/description/OG
  → HTML (сервер) → гидратация только нужных чанков
```

### Поток мутации (админка)

```
<Form method="post" encType="multipart/form-data">   ← работает без JS
  → route.action({ request, params })
      → requireAdmin(request)                        (сессия + Origin)
      → rateLimit(key)
      → схема Zod (formData → объект)
      → сервис домена (projects.create / media.process …)
      → redirect('/admin/projects?ok=1') или return { errors }
  → React Router автоматически ревалидирует loader'ы страницы
```

Ошибки валидации возвращаются объектом (`{ errors, values }`) и рендерятся в форме; `useNavigation` даёт состояние «сохраняется» без ручного стейта. Черновик формы проекта сохраняется в `localStorage` (защита от потери при мобильной разработке).

### Публичные JSON-эндпоинты

Отдельный REST-слой не создаётся: если понадобится частичная подгрузка (например, «показать ещё» в галерее), добавляется resource route `routes/api.photos.ts`, возвращающий `Response.json(...)`. Контракт задаётся Zod-схемой из `app/lib/validation`, а не отдельным DTO-слоем.

---

## 8. Изображения: упрощённый конвейер

**Принцип:** меньше вариантов, но правильные. Вместо 18 файлов на изображение — **6 + OG**.

| Вариант | Назначение |
| --- | --- |
| `w480` AVIF + WebP | Превью в сетке галереи, мобильный экран |
| `w960` AVIF + WebP | Карточка/страница кейса на телефоне, retina-превью |
| `w1600` AVIF + WebP | Десктоп, просмотр в лайтбоксе |
| `og` 1200×630 WebP | Open Graph/Twitter (генерируется при публикации) |
| оригинал | Приватно, только для повторной обработки |

Правила:

- `sharp`: `withoutEnlargement: true`, авто-ориентация по EXIF, затем **метаданные удаляются**; кодирование с явным `quality` (AVIF ~55–60, WebP ~72).
- Имена — `<sha256[:16]>` + суффикс варианта; публичный URL неизменяем → `Cache-Control: public, max-age=31536000, immutable`.
- `blurhash` (16 px превью для строки) — заполняется в БД, отдаётся в разметке как фон с `background-size: cover`.
- Генерация выполняется в `action` (синхронно, с лимитом 20 файлов за запрос). Если обработка начнёт заметно тормозить загрузку — вынести в очередь отдельным этапом (не сейчас).
- Лимиты приёма: 15 MB/файл, ≤ 40 МП, только JPEG/PNG/WebP/AVIF (проверка magic bytes), SVG/GIF запрещены.
- Удаление: медиа-запись помечается, файлы удаляет скрипт обслуживания после проверки ссылок.

**Хранение:** `storage/index.ts` с реализациями `local` (том `.data/media`, текущая) и `s3` (позже). Ни один модуль домена не обращается к файловой системе напрямую — только через адаптер.

**Раздача:** в dev и при односерверном деплое допустима отдача через resource route; в production Caddy отдаёт `/media/*` напрямую из каталога (быстрее и без Node-буфера).

---

## 9. Авторизация и сессии

- Один пользователь `admin`; пароль хранится как Argon2id (`argon2`, memory ≥ 64 MB).
- Сессия — строка в таблице `sessions` (в БД только SHA-256 хеш токена), cookie `__Host-exs_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, TTL 7 дней; при входе создаётся новая сессия, при смене пароля все прочие отзываются.
- Мутации защищаются проверкой `Origin`/`Sec-Fetch-Site` (эквивалент CSRF-заголовка в stateless-подходе) + `SameSite=Lax`.
- Rate limit входа: 5 попыток / 15 мин на `ip+login`, 20 / час на IP; одинаковая ошибка и схожее время ответа (без user enumeration).
- `requireAdmin` вызывается и в layout-`loader`, и в каждом `action` админки.
- TOTP — после релиза (Q12).

---

## 10. SEO и рендеринг

| Тип страницы | Стратегия |
| --- | --- |
| Home, About, Contact | SSR; допустим `prerender` на сборке (статичные маркетинговые страницы) |
| Development, Photography | SSR + `Cache-Control: public, max-age=60, stale-while-revalidate=300` |
| Project Details, Photo Details | SSR, метаданные из БД, минимальный кэш |
| Admin | SSR без кэша, `X-Robots-Tag: noindex` |

- Метаданные — через экспорт `meta()` в route-модуле: title, description, canonical, OG/Twitter, JSON-LD (`Person`, `CreativeWork`, `ImageObject`, `BreadcrumbList`).
- `sitemap.xml` и `robots.txt` — resource routes, генерируются из опубликованных записей.
- Админские и приватные ответы — `Cache-Control: no-store`.
- При смене slug — 301 из таблицы `redirects` (проверка в том же route-модуле).
- Прогрессивное улучшение: навигация и формы работают без JS; SSR отдаёт готовый HTML с контентом.

---

## 11. Структура репозитория

Старая версия сайта остаётся на месте. Новое приложение живёт в `apps/web/` и не пересекается с `src/`.

```
Excelsio_Moments/
├── AGENTS.md
├── README.md
├── .gitignore
├── docs/                        # документация
├── src/                         # EXCELSIO v1 — НЕ ТРОГАТЬ (архив/действующая публикация)
├── .github/
│   └── workflows/               # CI (появляется на Этапе 2)
├── deploy/                      # docker-compose.yml, Caddyfile, runbook-скрипты (Этап 11)
└── apps/
    └── web/                     # единственный пакет приложения (не монорепо)
        ├── package.json
        ├── react-router.config.ts
        ├── vite.config.ts
        ├── tsconfig.json
        ├── drizzle.config.ts
        ├── .env.example
        ├── Dockerfile
        ├── drizzle/             # миграции
        ├── public/              # статические файлы, шрифты, favicon
        └── app/                 # код приложения (конвенция React Router; аналог src/)
            ├── root.tsx
            ├── routes.ts
            ├── routes/
            ├── components/      # ui/ и features/
            ├── server/          # db, auth, media, storage, notify, seo, security
            ├── lib/             # validation, format, motion, image
            ├── styles/          # tokens.css, reset.scss, base.scss, миксины
            └── content/ru.ts
```

Решения по структуре:

- **Никакого монорепо и workspaces.** Один `package.json` в `apps/web/`; корень репозитория остаётся «домом» для документации, старой версии и деплой-файлов.
- `app/` вместо `src/` — конвенция React Router (каталог настраивается в `react-router.config.ts`, но менять его нет причин: `src/` уже занят версией 1).
- Локальные данные (БД, медиа) — `apps/web/.data/` и `apps/web/.data/media/`, в `.gitignore`.
- Пути импортов — через alias `~/*` → `app/*`.

---

## 12. Конфигурация и окружения

Переменные читаются на старте в `app/server/config.ts` через Zod; отсутствие обязательной переменной — падение с понятным сообщением (без «тихих» дефолтов для секретов).

```
NODE_ENV=production
PUBLIC_SITE_URL=https://excelsio-moments.ru
DATABASE_PATH=./.data/app.sqlite
SESSION_SECRET=<64+ random bytes>
ADMIN_EMAIL=…
ADMIN_PASSWORD_HASH=<argon2id>
STORAGE_DRIVER=local            # local | s3 (позже)
STORAGE_LOCAL_DIR=./.data/media
TELEGRAM_BOT_TOKEN=…            # этап 8
TELEGRAM_CHAT_ID=…              # этап 8
SMTP_*                          # этап 8 (резерв)
```

| Окружение | БД | Медиа | Запуск |
| --- | --- | --- | --- |
| local (Acode / терминал) | `.data/app.sqlite` | `.data/media` | `npm run dev` |
| CI (GitHub Actions) | файл во временном каталоге | временный каталог | `npm ci && npm run typecheck && npm run lint && npm run test && npm run build` |
| production (VPS) | `/srv/excelsio/data/app.sqlite` | `/srv/excelsio/data/media` | `npm run start` (`@react-router/serve`) за Caddy, systemd или Docker |

---

## 13. Сборка, CI и деплой

**Сборка:** `react-router build` → `build/client` (статика) + `build/server` (серверный бандл). Production-запуск — `@react-router/serve` (минимальный Express-сервер) за Caddy; альтернатива — собственный адаптер на `@react-router/node` (не требуется сейчас).

**CI (Этап 2):** `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: apps/web } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm, cache-dependency-path: apps/web/package-lock.json }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

Статус: **файл ещё не создан и workflow ни разу не запускался** — утверждать работоспособность CI нельзя до первого успешного прогона. Риск: GitHub-плагин Acode может не иметь scope `workflow` для создания файлов в `.github/workflows/` (тогда файл добавляется через веб-интерфейс GitHub).

**Деплой (Этап 11):** VPS + Caddy + systemd (или Docker Compose) + `deploy/`-файлы; бэкап `app.sqlite` через `VACUUM INTO`/`.backup` и rsync медиа; health-check `/health`; внешний uptime-мониторинг с алертом в Telegram.

---

## 14. Наблюдаемость и обслуживание

- Логи — stdout процесса (JSON в production, читаемый в dev), без секретов и текстов заявок; `requestId` в ответах об ошибках.
- Ошибки — `ErrorBoundary` (корневой и админский), нейтральные сообщения клиенту, детали только в лог.
- `/health` — проверка чтения из БД (например, `SELECT 1`) и доступности каталога медиа.
- Скрипты обслуживания (`apps/web/scripts/`): `seed-admin.ts`, `backup.ts` (БД + медиа), `gc-media.ts` (уборка неиспользуемых файлов), `reindex-media.ts` (перегенерация вариантов).

---

## 15. Путь роста (если понадобится)

1. **Кэш:** `Cache-Control` + in-memory кэш публичных loader'ов; при нескольких инстансах — Redis.
2. **PostgreSQL:** переход возможен, но **не автоматически**. Требуется: сменить диалект `drizzle-kit` (`sqlite` → `postgresql`), драйвер (`better-sqlite3`/`node-sqlite` → `pg`/`postgres.js`), типы колонок (`integer timestamp_ms` → `timestamptz`, `text(json)` → `jsonb`, `text(bool)` → `boolean`), переписать сгенерированные миграции (SQLite-миграции несовместимы), экспортировать/импортировать данные скриптом и перепроверить все запросы. Планируемая трудоёмкость — отдельный этап (1–2 сессии), а не «переключение переменной».
3. **S3/CDN:** включение `STORAGE_DRIVER=s3` + перенос существующих файлов скриптом.
4. **Мультиязычность:** `locale` в сущностях и префикс маршрутов.
5. Микросервисы и Kubernetes не планируются: порог оправданности для персонального сайта не достигается.

---

## 16. Риски текущего решения

| Риск | Влияние | Смягчение |
| --- | --- | --- |
| SSR-код случайно попадает в клиентский бандл | рост бандла, утечка серверной логики | `*.server.ts`, проверка размера чанков в CI, ревью импортов |
| SQLite-блокировки при параллельной записи | редкие 500 при одновременных сохранениях | WAL, `busy_timeout=5000`, короткие транзакции |
| Native-модули (`sharp`, `better-sqlite3`) не собираются в терминале Android | нет локального dev-сервера | сборка/тесты в CI; запасной драйвер `node:sqlite` (см. D-018) |
| Плагин GitHub без scope `workflow` | нельзя создать CI-файл через агента | добавить файл через веб-интерфейс GitHub |
| Обновление мажорной версии React Router (v8) | миграция в будущем | ветка v7 поддерживается патчами; отдельный ADR перед обновлением |

---

## 17. Что требует утверждения владельцем

1. **D-016:** React Router 7.18.x Framework Mode вместо Fastify + Vite SSR (и отдельного API).
2. **D-017:** SQLite + Drizzle как основная БД (PostgreSQL — путь роста, не автоматический перенос).
3. **D-018:** драйвер SQLite: `better-sqlite3` (по умолчанию) против `node:sqlite` (без native-сборки).
4. **D-019:** версия React Router — 7.18.x (рекомендуется) или 8.5.x.
5. **D-021:** один пакет `apps/web/` вместо workspaces; старая версия в `src/` не перемещается.
6. **D-022:** упрощённый медиа-конвейер (3 ширины × 2 формата + OG).
7. **D-023:** CI в GitHub Actions как основной способ сборки при разработке с Android.
