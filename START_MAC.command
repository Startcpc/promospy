#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Нужен Python 3.9+ с python.org. Если Node.js уже есть — используйте pnpm dev."
  exit 1
fi
exec python3 start.py "$@"
