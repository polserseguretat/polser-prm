-- =====================================================================
-- PRM POLSER — Migració 07: motor d'automatitzacions amb n8n
--
-- Decisió (CEO, 09/09/2026): la lògica de negoci s'orquestra amb n8n, no
-- amb Directus Flows (la llicència free en limita el nombre). El disparador
-- d'events es fa amb PostgreSQL (LISTEN/NOTIFY): quan s'insereix un referit
-- es notifica el canal 'prm_referral_changes' i n8n (nodo Postgres Trigger)
-- executa la sincronització amb Odoo (crea la crm.lead, alta immediata).
--
-- El payload del NOTIFY només porta id + referral_code (mai dades personals
-- del client, RGPD). n8n obté la resta per la API de Directus.
--
-- Executar COM A SUPERUSUARI (pgAdmin, usuari postgres/owner) sobre la BBDD
-- del PRM (per defecte `prm`).
-- =====================================================================

-- 1) Nou valor a sync_action per al log de creació d'oportunitat
ALTER TYPE sync_action ADD VALUE IF NOT EXISTS 'create_opportunity';

-- 2) Rol de n8n a la BD del PRM (llegeix per LISTEN/polling).
--    ⚠️ Després de crear-lo, estableix una contrasenya forta:
--       ALTER ROLE n8n WITH LOGIN PASSWORD '<password_fort>';
--       (la contrasenya la fa servir n8n a les seves credencials Postgres)
--    ⚠️ Les ESCRIPTURES cap al PRM es fan sempre per la API de Directus
--       (token tècnic POLSER_admin), mai per la BD. Si algun dia un workflow
--       necessités escriptura directa, descomenta el GRANT ALL del final.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n') THEN
    CREATE ROLE n8n LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO n8n;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO n8n;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO n8n;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO n8n;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO n8n;

-- 3) Notificació per INSERT a referrals → canal 'prm_referral_changes'
CREATE OR REPLACE FUNCTION notify_referral_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'prm_referral_changes',
    json_build_object(
      'event', 'referral.created',
      'id', NEW.id,
      'referral_code', NEW.referral_code,
      'odoo_sync_status', NEW.odoo_sync_status
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_referral_notify ON referrals;
CREATE TRIGGER trg_referral_notify
AFTER INSERT ON referrals
FOR EACH ROW EXECUTE FUNCTION notify_referral_change();

-- =====================================================================
-- FI DE LA MIGRACIÓ 07
-- =====================================================================