# Постоянный сервер и резервные копии

Подготовлены конфигурации для одного Linux-сервера с systemd, Node.js 24+ и Caddy. Это комплект для установки: внешний сервер в этой работе не предоставлен и не развёрнут. SQLite должна находиться на локальном постоянном диске. Не запускайте несколько хостов с отдельными копиями этой базы.

## Подготовка

1. Установите Node.js 24+, pnpm и Caddy. Для запуска сборщика серверу нужен исходящий HTTPS к официальным сайтам; проверьте доступ именно с него. Тануки по-прежнему может блокировать запросы.
2. Создайте системного пользователя и каталог для данных:

```sh
sudo useradd --system --home /var/lib/promospy --shell /usr/sbin/nologin promospy
sudo install -d -o promospy -g promospy -m 700 /var/lib/promospy
```

3. Распакуйте проект в `/opt/promospy`. Команды установки и сборки выполняйте обычным пользователем с правом записи в этот каталог:

```sh
cd /opt/promospy
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:generate
PLAYWRIGHT_BROWSERS_PATH=/opt/promospy/browsers pnpm exec playwright install chromium
# Системные библиотеки браузера, если они отсутствуют:
sudo pnpm exec playwright install-deps chromium
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Сборочные скрипты нужных зависимостей перечислены в `pnpm-workspace.yaml`. Установка движков Prisma и Chromium требует доступа к серверам их загрузки.

4. При первой установке перенесите включённый снимок базы. На уже работающем сервере эту команду **не повторять**: она перезапишет текущую базу.

```sh
sudo install -o promospy -g promospy -m 600 db/custom.db /var/lib/promospy/custom.db
sudo install -o root -g promospy -m 640 deploy/promospy.env.example /etc/promospy.env
sudo install -m 644 deploy/systemd/promospy* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now promospy.service promospy-backup.timer
```

Проверьте путь `/usr/bin/node` в обоих unit-файлах: `command -v node`. Каталог приложения и `browsers` должны быть доступны пользователю `promospy` для чтения и исполнения. Запись разрешена в `/var/lib/promospy`. Сервис включает один встроенный worker; второй отдельно запускать не нужно.

5. В `deploy/Caddyfile` укажите свой домен, направьте DNS на сервер и установите эту конфигурацию как `/etc/caddy/Caddyfile`. Затем `sudo systemctl reload caddy`. Caddy выпускает HTTPS-сертификат; наружу нужны порты 80 и 443. Next.js слушает только `127.0.0.1:3000`.

## Проверка и наблюдение

```sh
curl --fail http://127.0.0.1:3000/api/health
sudo systemctl status promospy.service
sudo journalctl -u promospy.service -n 80 --no-pager
sudo systemctl start promospy-backup.service
sudo journalctl -u promospy-backup.service -n 20 --no-pager
sudo systemctl list-timers promospy-backup.timer
sudo systemctl restart promospy.service
curl --fail http://127.0.0.1:3000/api/health
```

`/api/health` проверяет доступность таблиц базы (HTTP 200/503). Это проверка приложения, а не гарантия загрузки магазинов: ошибки конкретных источников видны на их страницах и в журнале обновления. Успешная дата официального мониторинга не сдвигается при ошибке. Для внешнего мониторинга настройте периодический запрос health и уведомления в выбранной вами системе.

После рестарта проверьте `/company/54` и `/company/201`: сохранились коды, даты и история; очередь продолжает работать. Задача, прерванная аварийно, возвращается после истечения аренды (до 90 секунд). Новые обновления — каждый час, ошибки официального сбора — повтор через 15 минут.

## Резервная копия

Локально: `pnpm db:backup`. На сервере ежедневный timer запускает копирование около 03:15 МСК с разбросом до пяти минут; пропущенный запуск выполняется после включения сервера. SQLite online backup включает подтверждённые записи из WAL даже при работающем приложении. Перед публикацией файла проверяются целостность и наличие таблиц PromoSpy. Копии имеют уникальные имена; неполная копия не становится готовой.

Переменные: `PROMO_BACKUP_DIR` (по умолчанию `backups` рядом с базой), `PROMO_BACKUP_KEEP_DAYS=14`. Очистка старых файлов выполняется только после успешной новой копии и затрагивает только имена, созданные этим скриптом. Каталог копий не следует размещать внутри `public/`.

Копии на том же диске защищают от ошибок данных, но не от потери сервера. Настройте отдельное хранилище и копируйте туда готовые `.db` после успешного задания; аккаунт внешнего хранилища в проект не добавлен.

## Восстановление

Сначала остановите **все** процессы приложения и worker, использующие базу. Команда не определяет автоматически, остановлены ли они; флаг подтверждает действие оператора.

```sh
sudo systemctl stop promospy.service
cd /opt/promospy
sudo -u promospy /usr/bin/node --env-file=/etc/promospy.env scripts/restore-db.mjs /var/lib/promospy/backups/ИМЯ-КОПИИ.db --server-stopped
sudo systemctl start promospy.service
curl --fail http://127.0.0.1:3000/api/health
```

Источник проверяется до изменения базы. Перед восстановлением создаётся копия текущей базы; если она повреждена и копирование не прошло, восстановление останавливается. Повреждённый файл необходимо отдельно сохранить и убрать вручную после диагностики. После восстановления снова проверяется целостность.

Перед обновлением приложения сделайте копию. Не применяйте `db:reset` к рабочей базе. В данном обновлении схема не менялась.
