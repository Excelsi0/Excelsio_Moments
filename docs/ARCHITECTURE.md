# ARCHITECTURE — EXCELSIO 2.0

**Статус:** предложение (Этап 1), требует утверждения владельцем. Изменения — только через ADR в `docs/DECISIONS.md`.
**Связанные документы:** `REQUIREMENTS.md`, `TECH_STACK.md`, `DESIGN_SYSTEM.md`, `SECURITY.md`, `ROADMAP.md`.

---

## 1. Принципы архитектуры

1. **Один деплой, один репозиторий.** Не микросервисы. Один процесс Node.js отдаёт HTML, статику и API; одна БД; одно хранилище медиа.
2. **Модульный монолит.** Код делится по доменам (`projects`, `photos`, `media`, `applications`, `auth`, `settings`), а не по «слоям ради слоёв».
3. **Один контракт типов.** Zod-схемы домена в `packages/shared` используются и на клиенте, и на сервере.
4. **Контент — в БД, а не в коде.** Любой текст, проект, фото, категория меняются из админки.
5. **Mobile-first и производительность.** Серверный HTML, минимум JS на публичных страницах, ленивые чанки, оптимизированные изображения.
6. **Безопасность по умолчанию.** Приватные эндпоинты закрыты сессией, загрузки перекодируются, секреты — только в окружении.
7. **Простота важнее модности.** Если стандартные средства решают задачу — используем их.

---

## 2. Рекомендуемая архитектура (вариант A)

```
                        ┌────────────────────────────────────────┐
   Браузер (mobile)     │  Caddy / Nginx (HTTPS, gzip/brotli)    │
   Browser (desktop) ───►  статика + reverse proxy               │
                        └───────────────┬────────────────────────┘
                                        │ :3000
                        ┌───────────────▼────────────────────────┐
                        │  Node.js: Fastify + Vite SSR           │
                        │  ┌──────────────────────────────────┐  │
                        │  │ Публичный слой (HTML)            │  │
                        │  │  React Router + SSR-рендер        │  │
                        │  │  метаданные, OG, JSON-LD          │  │
                        │  ├──────────────────────────────────┤  │
                        │  │ REST API /api/v1                  │  │
                        │  │  public: projects, photos, form   │  │
                        │  │  admin: CRUD + upload (+ session) │  │
                        │  ├──────────────────────────────────┤  │
                        │  │ Сервисы домена                    │  │
                        │  │  media pipeline (sharp)           │  │
                        │  │  notifier (Telegram / SMTP)       │  │
                        │  │  seo (sitemap, meta)              │  │
                        │  ├──────────────────────────────────┤  │
                        │  │ Инфраструктура                    │  │
                        │  │  Drizzle ORM · config (Zod)       │  │
                        │  │  logger (pino) · storage adapter  │  │
                        │  └──────────────────────────────────┘  │
                        └───────┬───────────────────┬────────────┘
                                │                   │
                    ┌───────────▼─────┐   ┌─────────▼────────────┐
                    │ PostgreSQL 16+  │   │ Storage (S3 / том)   │
                    │ контент, заявки │   │ медиа-варианты       │
                    │ сессии, настройки│  │ оригиналы (private)  │
                    └─────────────────┘   └──────────────────────┘
```

**Ключевое решение:** сайт рендерится на сервере (SSR) тем же React-приложением, которое затем гидрируется. Это даёт:
- готовые метаданные и HTML для поисковиков и мессенджеров без prerender-костылей;
- мгновенное появление новых проектов из админки (без пересборки и ручного деплоя);
- один серверный процесс и один деплой.

**Почему не чистый SPA:** кейсы и фотографии — контент, который делят ссылками в Telegram. Без серверных метаданных превью в мессенджерах и индексация страдают. Чистый SPA допустим как упрощённый вариант (см. альтернативу B в `TECH_STACK.md`), но тогда OG-теги придётся решать отдельно (пререндер/edge-функции), что не проще.

---

## 3. Компоненты и ответственность

### 3.1 Frontend (`apps/web`)

| Слой | Ответственность |
| --- | --- |
| `app/` | Точка входа (клиент и сервер), роутер, провайдеры (query client, error boundary, theme tokens) |
| `pages/` | Страницы: home, development, project-details, photography, photo-details, about, contact, not-found, admin/* |
| `features/` | Доменные блоки с логикой: `projects-list`, `photo-gallery`, `lightbox`, `contact-form`, `admin-projects`, `admin-photos`, `admin-applications`, `admin-media`, `auth` |
| `components/ui/` | Презентационные переиспользуемые компоненты (Button, Input, Dialog, Toast, Skeleton, Badge, Tabs, Dropzone…) |
| `lib/` | `api` (типизированный клиент), `seo` (meta-хелперы), `motion` (варианты анимаций, `useReducedMotion`), `image` (srcset/blurhash), `format` |
| `styles/` | `tokens.css` (CSS-переменные), `reset.scss`, `base.scss`, утилиты, миксины |
| `content/ru.ts` | Все тексты интерфейса (лейблы, кнопки, ошибки) |

Правила: страницы не ходят в сеть напрямую (`lib/api`), не содержат «магических» цветов (только `var(--ex-*)`), не дублируют разметку (выносят в `components/ui`).

### 3.2 Backend (`apps/api`)

| Модуль | Ответственность |
| --- | --- |
| `core/config` | Чтение `.env` через Zod, падение на старте при неполной конфигурации |
| `core/db` | Подключение, Drizzle schema, миграции, транзакции |
| `core/http` | Создание Fastify, плагины (cookie, helmet-аналоги, rate-limit, multipart, static), обработчик ошибок |
| `core/logger` | pino, уровни, redaction секретов |
| `modules/auth` | `POST /login`, `POST /logout`, `GET /me`, сессии, хеширование пароля, rate limit |
| `modules/projects` | CRUD проектов, публичная выдача, порядок, публикация |
| `modules/photos` | CRUD фотографий, категории фото, публичная выдача |
| `modules/categories` | Категории проектов и фотографий |
| `modules/media` | Приём файла, валидация, `sharp`-конвейер, blurhash, варианты, адаптер хранилища |
| `modules/applications` | Приём заявки, антиспам, статусы, список для админки |
| `modules/settings` | Настройки сайта (не секреты) |
| `modules/seo` | `sitemap.xml`, `robots.txt`, meta-данные страниц |
| `modules/notifications` | Telegram Bot API, SMTP-канал, шаблоны сообщений |
| `modules/admin` | Сборка админ-роутов, guard по сессии, CSRF-проверка |

Каждый модуль: `routes.ts` (HTTP), `service.ts` (бизнес-логика), `repository.ts` (запросы к БД), `schema.ts` (Zod). Слой routes не содержит SQL, слой repository не знает про HTTP.

### 3.3 Shared (`packages/shared`)

- Zod-схемы сущностей (`ProjectSchema`, `PhotoSchema`, `CategorySchema`, `ApplicationInputSchema`, `LoginSchema`…).
- Типы, выведенные из схем (`z.infer`), — единственный источник типов домена.
- Константы (лимиты размеров, допустимые MIME, статусы).
- Утилиты без побочных эффектов (slugify, форматирование дат).

---

## 4. Модель данных (черновик)

```
admin_users            sessions                    settings
─────────────          ────────                    ────────
id (uuid, pk)          id (uuid, pk)               key (text, pk)
email (unique)         user_id  → admin_users.id   value (jsonb)
password_hash          token_hash (unique)         updated_at
role = 'admin'         expires_at
totp_secret (null)     created_at
created_at             revoked_at
last_login_at          ip_hash, user_agent

categories                                 projects
──────────                                 ────────
id (uuid, pk)                              id (uuid, pk)
slug (unique, kind+slug)                   slug (unique)
title                                      title
kind: 'project' | 'photo'                  summary
sort_order                                 description (jsonb: блоки контента)
created_at                                 status: draft | published | archived
                                           featured (bool)
                                           year, role, client
                                           stack (text[])
                                           links (jsonb: live, repo)
                                           cover_media_id → media.id
                                           category_id → categories.id
                                           seo_title, seo_description
                                           sort_order, published_at
                                           created_at, updated_at

media                                      photos
─────                                      ──────
id (uuid, pk)                              id (uuid, pk)
storage_key (hash-имя, private)            slug (unique)
public_path (базовый путь вариантов)       title
width, height                              description
format, bytes                              category_id → categories.id
variants (jsonb: [w320, w640, …] по форматам)  media_id → media.id
blurhash                                   status: draft | published
alt (text)                                 taken_at, location, camera
created_at                                 sort_order, published_at
                                           created_at, updated_at

project_media                              applications
─────────────                              ────────────
project_id → projects.id                   id (uuid, pk)
media_id   → media.id                      name, contact, contact_type
sort_order                                 topic (null)
caption (null)                             message
                                           status: new | read | replied | spam
                                           page_url (null)
                                           ip_hash, user_agent
                                           created_at, handled_at

audit_log (опционально, этап 9+)
id, actor_id, action, entity, entity_id, payload jsonb, created_at
```

**Правила модели:**

- Slug уникален и иммутабелен: смена slug создаёт запись в таблице `redirects` (`from`, `to`, 301).
- Черновики никогда не попадают в публичные выборки и в sitemap.
- Оригиналы медиа не публикуются; публично доступны только производные варианты.
- Удаление проекта/фото — мягкое (`archived`/`deleted_at`) там, где важно сохранить ссылку; медиа удаляется сборщиком мусора, а не сразу в запросе.
- Порядок вывода — явное поле `sort_order` + вторичная сортировка по дате.

---

## 5. API-контракт (REST, `/api/v1`)

### Публичные (без авторизации)

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/api/v1/projects?category=&year=&limit=&offset=` | Список опубликованных проектов (краткие карточки) |
| GET | `/api/v1/projects/:slug` | Полный кейс + галерея + соседние проекты |
| GET | `/api/v1/photos?category=&limit=&offset=` | Список опубликованных фото с вариантами и blurhash |
| GET | `/api/v1/photos/:slug` | Одна фотография |
| GET | `/api/v1/categories?kind=project|photo` | Категории |
| GET | `/api/v1/settings/public` | Публичные настройки (контакты, соцсети, тексты) |
| POST | `/api/v1/applications` | Заявка с контактной формы (rate limit, honeypot) |
| GET | `/api/v1/health` | Health-check |
| GET | `/sitemap.xml`, `/robots.txt` | SEO |

### Административные (сессия + CSRF-заголовок)

| Метод | Путь |
| --- | --- |
| POST | `/api/v1/auth/login`, `/api/v1/auth/logout` |
| GET | `/api/v1/auth/me` |
| GET/POST/PATCH/DELETE | `/api/v1/admin/projects[/:id]` |
| GET/POST/PATCH/DELETE | `/api/v1/admin/photos[/:id]` |
| GET/POST/PATCH/DELETE | `/api/v1/admin/categories[/:id]` |
| POST | `/api/v1/admin/media` (multipart), DELETE `/api/v1/admin/media/:id` |
| GET/PATCH/DELETE | `/api/v1/admin/applications[/:id]` |
| GET/PUT | `/api/v1/admin/settings` |

**Конвенции ответов:**

```jsonc
// успех
{ "data": { /* Zod-проверенный DTO */ }, "meta": { "total": 24, "limit": 12, "offset": 0 } }

// ошибка
{ "error": { "code": "VALIDATION_ERROR", "message": "Проверьте поля", "fields": { "name": "Обязательное поле" } } }
```

- Ошибки — только коды из фиксированного перечня (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL`).
- Никаких `any` в DTO: DTO генерируются из Zod-схем.
- Публичные DTO не содержат `status`, `ip_hash`, e-mail заявок и служебные поля.

---

## 6. Ключевые потоки данных

### 6.1 Загрузка изображения (админка)

```
[Клиент] выбор файла → превью (objectURL)
   ↓ POST multipart (credentials: include, X-CSRF-Token)
[Fastify] auth guard → CSRF → rate limit → лимит размера
   ↓
[media service] 1. проверка magic bytes (JPEG/PNG/WebP/AVIF)
                2. декодирование sharp, отказ при ошибке
                3. авто-ориентация по EXIF → EXIF удаляется
                4. варианты w320…w2560 в AVIF + WebP + JPEG
                5. blurhash
                6. hash имени (sha256[:16]) → storage
   ↓
[DB] запись media (варианты, размеры, blurhash) → ссылка на photo/project
   ↓ 200 { data: { id, variants, blurhash, width, height } }
```

Ограничения: 15 MB на файл, не более 20 файлов за запрос (мультизагрузка), 12 000 px по большей стороне, отказ при превышении пикселей (защита от decompression bomb).

### 6.2 Контактная форма

```
[Форма] Zod на клиенте → POST /api/v1/applications
   ↓ honeypot пустой? время заполнения ≥ 3 c? rate limit ok?
[service] INSERT application (status='new', ip_hash)
   ↓
[notifier] Telegram sendMessage (async, 3 попытки, ошибка → лог)
   ↓ 201 { data: { id } } → клиент показывает успех
```

Заявка сохраняется **до** отправки уведомления: сбой внешнего канала не приводит к потере обращения.

### 6.3 Публичный запрос страницы

```
GET /development/my-case
   ↓ Fastify route → SSR loader (projects.getBySlug)
   ↓ React рендер → <head> с title/description/OG/JSON-LD
   ↓ HTML + гидрируемый payload → клиент
   ↓ Клиент догружает только нужные чанки (admin не грузится)
```

Кэширование: публичные GET-ответы — `Cache-Control: public, max-age=60, stale-while-revalidate=300`; инвалидация по тегу при изменениях в админке (в памяти процесса; при масштабировании — Redis или полный сброс по TTL, что приемлемо).

---

## 7. Рендеринг и SEO-стратегия

| Тип страницы | Рендер | Причина |
| --- | --- | --- |
| Home, About, Contact | SSR + кэш 60 c | Быстро, свежие метаданные |
| Development, Photography | SSR + кэш 60 c | Данные из БД, фильтры в query |
| Project Details, Photo Details | SSR без агрессивного кэша (или 60 c) | Уникальные метаданные, шаринг |
| Admin | Только клиентский рендер (`noindex`) | Не нужен SEO, экономия серверных чанков |

Реализация: `entry-client.tsx` + `entry-server.tsx`, `renderToString`/`renderToPipeableStream` на сервере, гидратация на клиенте. Метаданные собираются на сервере из данных БД (никакой «мигающей» подмены `document.title`).

---

## 8. Структура репозитория (целевая)

```
excelsio-moments/
├── AGENTS.md
├── README.md
├── package.json                 # npm workspaces
├── tsconfig.base.json
├── .env.example                 # только имена переменных, без секретов
├── docs/                        # документация
├── legacy/
│   └── v1/                      # первая версия сайта (архив, этап 2)
├── apps/
│   ├── web/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── src/
│   │   │   ├── app/  pages/  features/  components/  lib/  styles/  content/
│   │   │   └── entry-client.tsx, entry-server.tsx
│   │   └── public/
│   └── api/
│       ├── src/
│       │   ├── server.ts        # entry: Fastify + SSR-мост в dev/prod
│       │   ├── core/
│       │   └── modules/
│       └── drizzle/             # миграции
├── packages/
│   └── shared/
│       └── src/{schemas,types,constants,utils}/
├── scripts/                     # бэкап, генерация sitemap, обслуживание медиа
└── docker/                      # Dockerfile, docker-compose.yml, Caddyfile
```

Опциональная альтернатива: единый пакет без workspaces (`src/` + `server/`). Обоснование выбора workspaces — в `TECH_STACK.md`, решение D-011.

---

## 9. Окружения и конфигурация

| Окружение | Назначение | БД | Медиа |
| --- | --- | --- | --- |
| `local` | Разработка в Acode / терминале | PostgreSQL в Docker или SQLite-файл | `./.data/media` |
| `preview` (опционально) | Проверка перед релизом | отдельная БД | отдельный бакет/каталог |
| `production` | `excelsio-moments.ru` | managed/локальный PostgreSQL | S3-совместимое хранилище или том + бэкап |

Конфигурация читается через `core/config` (Zod): `NODE_ENV`, `PORT`, `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `STORAGE_DRIVER` (`local` | `s3`), `STORAGE_*`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SMTP_*`, `PUBLIC_SITE_URL`. Приложение **падает на старте**, если переменная отсутствует или невалидна — «тихая» деградация запрещена.

---

## 10. Наблюдаемость, ошибки, обслуживание

- **Логи:** pino, JSON в production, `pretty` в dev; редактирование полей `password`, `token`, `cookie`, `message` (текст заявки).
- **Ошибки:** глобальный обработчик Fastify → код + логирование с `requestId`; клиент показывает нейтральное сообщение.
- **Health:** `GET /api/v1/health` → статус БД и хранилища.
- **Аналитика:** Яндекс.Метрика или self-hosted Umami (решение владельца), загрузка после согласия не требуется для анонимной статистики, но без сторонних трекеров в админке.
- **Бэкапы:** ежедневный `pg_dump` + синхронизация медиа, проверка восстановления раз в этап (см. `SECURITY.md`).
- **Миграции:** Drizzle, только вперёд, применяются в деплое перед стартом приложения; откат — из бэкапа.

---

## 11. Путь масштабирования (если понадобится)

1. **Сначала узкие места:** кэш публичных страниц (в памяти → Redis), вынос медиа на CDN.
2. **Горизонтальное масштабирование:** несколько инстансов приложения за прокси при условии, что сессии в БД (уже так) и кэш в Redis.
3. **Отдельный сервис изображений** — только если обработка станет заметной нагрузкой.
4. **Мультиязычность** — добавление `locale` в сущности и маршруты (`/en/...`).
5. Микросервисы не планируются: порог оправданности для персонального сайта не достигается.

---

## 12. Что требует утверждения владельцем

1. SSR (вариант A) против SPA + пререндер (вариант B) — влияет на сложность и качество SEO.
2. PostgreSQL против SQLite на старте.
3. S3-совместимое хранилище против локального тома.
4. Медиа-канал уведомлений: Telegram как основной (рекомендуется) + e-mail как резерв.
5. Судьба `src/` (v1): перенос в `legacy/v1/` на Этапе 2.
