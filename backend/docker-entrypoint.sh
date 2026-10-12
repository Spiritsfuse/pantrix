#!/bin/sh
# Apply database migrations, then hand PID 1 to the app server.
# Set RUN_MIGRATIONS=false where a separate init container already migrated.
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo '{"level":"INFO","logger":"pantrix.entrypoint","msg":"running alembic upgrade head"}'
  alembic upgrade head
fi

exec "$@"
