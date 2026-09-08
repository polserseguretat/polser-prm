-- =====================================================================
-- PRM POLSER — Migració 07: motor d'automatitzacions amb n8n
--
-- Decisió (CEO, 09/09/2026): la lògica de negoci s'orquestra amb n8n, no
-- amb Directus Flows (la llicència free en limita el nombre). El disparador
-- d'events el gestiona el mateix n8n: el nodo "Postgres Trigger" (mode
-- 'Table Row Change Events') CREA el seu propi trigger sobre `referrals`
-- (AFTER INSERT → pg_notify) quan s'activa el workflow i l'elimina en
-- desactivar-lo.
--
-- Aquesta migració només prepara la BD:
--   1) Nou valor a sync_action per al log de creació d'oportunitat.
--   2) Rol BD 'n8n' amb els permisos que el nodo necessita:
--        - USAGE + CREATE al schema (per crear la funció del trigger)
--        - TRIGGER sobre referrals (per crear/eliminar el trigger d'INSERT)
--        - SELECT (per al polling de pendents/errors, workflow de seguretat)
--   ⚠️ El payload del NOTIFY que genera n8n és row_to_json(NEW), és a dir,
--      LA FILA COMPLETA (inclou client_name/phone/email). Assumit (canal
--      intern de Postgres). Les ESCRIPTURES de negoci es fan sempre per la
--      API de Directus (token tècnic POLSER_admin), mai per la BD.
--
-- Executar COM A SUPERUSUARI (pgAdmin, usuari postgres/owner) sobre la BBDD
-- del PRM (per defecte `prm`).
-- =====================================================================

-- 1) Nou valor a sync_action per al log de creació d'oportunitat
ALTER TYPE sync_action ADD VALUE IF NOT EXISTS 'create_opportunity';

-- 2) Rol de n8n a la BD del PRM
--    ⚠️ Després de crear-lo, estableix una contrasenya forta:
--       ALTER ROLE n8n WITH LOGIN PASSWORD '<password_fort>';
--       (la contrasenya la fa servir n8n a les seves credencials Postgres)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n') THEN
    CREATE ROLE n8n LOGIN;
  END IF;
END
$$;

GRANT USAGE, CREATE ON SCHEMA public TO n8n;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO n8n;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO n8n;
GRANT TRIGGER ON referrals TO n8n;

-- =====================================================================
-- FI DE LA MIGRACIÓ 07
-- =====================================================================