# PromoSpy — как запустить

1. Установите Node.js 24+ и pnpm 11.
2. Откройте терминал в распакованной папке PromoSpy.
3. Выполните:

```sh
pnpm install --frozen-lockfile
```

Скопируйте `.env.example` в `.env` (в PowerShell: `Copy-Item .env.example .env`). Затем:

```sh
pnpm db:generate
pnpm exec playwright install chromium
pnpm dev
```

Откройте **http://localhost:3000**. Снимок базы уже включён, сброс базы не нужен. Для круглосуточной работы компьютер/сервер должен оставаться включённым; браузер можно закрыть.

Сборочные скрипты необходимых зависимостей разрешены в `pnpm-workspace.yaml`. На Linux браузеру могут понадобиться `pnpm exec playwright install --with-deps chromium`.

- ВкусВилл: `/company/54`, Магнит: `/company/201`.
- Проверка проекта: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:smoke`.
- Резервная копия: `pnpm db:backup`.
- Production: `pnpm build`, затем `pnpm start`.
- Установка на постоянный сервер: [инструкция](docs/server-setup.md).
- Выполненные изменения и границы проверки: [отчёт](docs/release-0.3.0.md).

Нужен доступ к сайтам магазинов и серверам загрузки зависимостей. Тануки автоматически не подключён: прежняя блокировка остаётся нерешённой. Новые магазины без проверки реального источника не объявлены рабочими.
