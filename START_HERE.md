# Как запустить

В терминале Codespaces из папки проекта:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

`.env` копируйте только при первом запуске. Откройте порт **3000**. Нужны Node.js 24+ и pnpm 11; API-ключи и Prisma не нужны.

После обновления: Ctrl+C → `git pull --ff-only` → `pnpm install --frozen-lockfile` → `pnpm dev`.

На главной выберите магазин. Поиск начнётся только после кнопки **«Найти промокоды»** на его странице. Сердечко сохраняет результат в избранное.
