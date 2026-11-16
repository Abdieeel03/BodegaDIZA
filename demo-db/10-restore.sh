#!/usr/bin/env bash
set -Eeuo pipefail

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-bodega_diza}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${SEED:-}" ]]; then
  SEED_PATH="$SEED"
elif [[ -f /opt/bodegadiza/demo.dump ]]; then
  SEED_PATH=/opt/bodegadiza/demo.dump
else
  SEED_PATH="$SCRIPT_DIR/bodega_diza_test_demo.dump"
fi

if [[ ! -f "$SEED_PATH" || ! -s "$SEED_PATH" ]]; then
  echo "ERROR: Falta el respaldo $SEED_PATH. Copia o genera demo-db/bodega_diza_test_demo.dump antes de iniciar." >&2
  exit 1
fi

echo "Preparando esquemas limpios en $POSTGRES_DB..."
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
DROP SCHEMA IF EXISTS staging_diza CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

echo 'Restaurando el esquema del entorno demostrativo...'
pg_restore --exit-on-error --no-owner --no-acl --section=pre-data -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$SEED_PATH"
echo 'Restaurando los datos (sin cuentas de usuarios originales)...'
pg_restore --exit-on-error --no-owner --no-acl --section=data -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$SEED_PATH"

# Las ventas y otros movimientos pueden tener usuario_id. Los IDs se conservan
# mediante cuentas ficticias INHABILITADAS para que todas las claves foraneas
# sigan siendo validas. El administrador de cada equipo lo crea Spring Boot.
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.usuarios') IS NULL THEN
    RAISE EXCEPTION 'El respaldo no contiene la tabla public.usuarios';
  END IF;
  FOR r IN
    SELECT table_schema, table_name
      FROM information_schema.columns
     WHERE column_name = 'usuario_id'
       AND table_schema NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format(
      'INSERT INTO public.usuarios(id, nombre, email, password, rol) '
      || 'SELECT DISTINCT t.usuario_id, %L, %L || t.usuario_id::text || %L, %L, %L '
      || 'FROM %I.%I AS t '
      || 'WHERE t.usuario_id IS NOT NULL AND '
      || 'NOT EXISTS(SELECT 1 FROM public.usuarios u WHERE u.id=t.usuario_id)',
      'Cuenta historica deshabilitada', 'historico-', '@example.invalid',
      'CUENTA_INHABILITADA', 'ADMIN', r.table_schema, r.table_name
    );
  END LOOP;
END $$;
DO $$
DECLARE seq text;
BEGIN
  SELECT pg_get_serial_sequence('public.usuarios', 'id') INTO seq;
  IF seq IS NOT NULL THEN
    EXECUTE format('SELECT setval(%L, %s, true)', seq,
      GREATEST(COALESCE((SELECT MAX(id) FROM public.usuarios),0),1));
  END IF;
END $$;
SQL

echo 'Restaurando indices y relaciones...'
pg_restore --exit-on-error --no-owner --no-acl --section=post-data -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$SEED_PATH"
echo 'Base de demostracion restaurada; los usuarios anteriores no tienen credenciales funcionales.'
