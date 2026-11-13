#!/usr/bin/env bash
set -Eeuo pipefail
SEED=/opt/bodegadiza/demo.dump
if [[ ! -f "$SEED" || ! -s "$SEED" ]]; then
  echo 'ERROR: Falta demo-db/bodega_diza_test_demo.dump. Copia el respaldo anonimo antes de iniciar.' >&2
  exit 1
fi

echo 'Restaurando el esquema del entorno demostrativo...'
pg_restore --exit-on-error --no-owner --no-acl --section=pre-data -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$SEED"
echo 'Restaurando los datos (sin cuentas de usuarios originales)...'
pg_restore --exit-on-error --no-owner --no-acl --section=data -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$SEED"

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
pg_restore --exit-on-error --no-owner --no-acl --section=post-data -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$SEED"
echo 'Base de demostracion restaurada; los usuarios anteriores no tienen credenciales funcionales.'
