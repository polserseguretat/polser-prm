# n8n · Motor d'automatitzacions — Sync d'alta amb Odoo (crm.lead)

Especificació dels workflows de **n8n** per a la sincronització d'alta immediata:
quan es registra un referit al PRM (INSERT a `referrals`), es crea l'oportunitat
`crm.lead` a Odoo i es vincula per `odo_opportunity_id`.

- **Decisió (CEO, 09/09/2026):** la lògica de negoci s'orquestra amb **n8n** (no amb
  Directus Flows). El disparador d'events és **PostgreSQL LISTEN/NOTIFY** (migració 07).
- **Document de referència:** `PLAN_IMPLEMENTACIO_PRM_DIRECTUS.md` §6.3.

---

## 0. Arquitectura

```
[Directus /portal → INSERT a referrals (knex directo)]
   │
   ▼ AFTER INSERT → pg_notify('prm_referral_changes', '{"event":"referral.created","id":...,"referral_code":"REF-XXXX"}')
n8n — Workflow B "on_referral_created" (Postgres Trigger = LISTEN)
   │  filter event == 'referral.created'
   ▼  Execute Workflow
n8n — Workflow A "process_referral" (sub-workflow reutilitzable, input: referral_id)
   │  ├─ GET /items/referrals/{id}        (Directus API, token tècnic)
   │  ├─ GET /items/services/{service_id} (per expected_revenue = alta_fee)
   │  ├─ idempotència: si odo_opportunity_id → FI
   │  ├─ Odoo JSON-RPC: search crm.lead per name = 'REF-XXXX%' (evita duplicats en reintents)
   │  ├─ Odoo JSON-RPC: create crm.lead
   │  └─ PATCH /items/referrals/{id} (odo_opportunity_id, odoo_sync_status='ok')
   │     + POST /items/odoo_sync_log (create_opportunity, ok)
   │  └─ error → PATCH odoo_sync_status='error' + odoo_sync_log failed
n8n — Workflow C "sync_retry" (Cron 15 min, xarxa de seguretat)
   │  SELECT referrals WHERE odoo_sync_status IN ('pendiente','error')
   ▼  Execute Workflow per cada id
```

**Regles d'enginyeria:**
- n8n **només LLEGEIX** la BD del PRM (LISTEN + polling). Totes les **ESCRIPTURES**
  es fan per la **API de Directus** amb un token tècnic (rol `POLSER_admin`).
- El payload del NOTIFY porta **només `id` + `referral_code`** (mai dades personals, RGPD).
- **Idempotència:** doble capa — `odo_opportunity_id` al PRM + cerca del lead per
  `name` a Odoo. Mai es duplica una oportunitat.

---

## 1. Requisits previs (configuració a n8n)

| Credencial / Variable | Valor | On es crea |
|---|---|---|
| **Postgres** (n8n) | host:port de la BD PRM, usuari `n8n`, contrasenya forta (establerta amb `ALTER ROLE n8n WITH LOGIN PASSWORD '...'` després de la migració 07) | n8n → Credentials → PostgreSQL |
| **Directus** (n8n) | `https://prmcore.polser.cat`, token static de l'usuari tècnic `n8n@polser.cat` (rol `POLSER_admin`) | Directus → Settings → Access → Tokens → **crear token**; a n8n: Credentials → **Header Auth** (`Authorization: Bearer <token>`) |
| **Odoo** (n8n) | `<odoo_url>`, `<db>`, `<login>`, `<apikey>` (usuari tècnic Odoo, mai admin) | n8n → Credentials → HTTP Header Auth, o variables al workflow |

Variables de workflow (n8n → Variables): `ODOO_URL`, `ODOO_DB`, `ODOO_LOGIN`, `ODOO_APIKEY`, `DIRECTUS_URL`.

> ⚠️ La migració 07 ja crea la funció `notify_referral_change()` i el trigger
> `trg_referral_notify` sobre `referrals`. n8n només s'ha de subscriure al canal.

---

## 2. Workflow B — `on_referral_created` (trigger)

**Trigger:** nodo **Postgres Trigger**
- Credential: Postgres (rol `n8n`).
- **Channel name:** `prm_referral_changes`
- Si el nodo demana taula/funció: `referrals` / `notify_referral_change` (ja existents).

Després del trigger:

1. **Nodo Set / Code** — extreu el payload:
   ```
   event = $json.event
   referral_id = $json.id
   referral_code = $json.referral_code
   ```
   (El nodo Postgres Trigger retorna el JSON del NOTIFY com a `$json`.)

2. **Nodo IF** — condició: `{{ $json.event }}` **equals** `referral.created`.
   - True → continua.
   - False → FI (no processar).

3. **Nodo Execute Workflow** (sub-workflow):
   - Workflow: `process_referral`
   - Mode: **Execute once per incoming item**
   - Payload: `{ "referral_id": "{{ $json.referral_id }}" }`

---

## 3. Workflow A — `process_referral` (lògica principal, sub-workflow)

Input (del nodo Execute Workflow Trigger): `$json.referral_id`.

### 3.1 Execute Workflow Trigger
Nodo inicial del sub-workflow (automàtic).

### 3.2 HTTP Request — GET referit (Directus)
- URL: `{{ $variables.DIRECTUS_URL }}/items/referrals/{{ $json.referral_id }}`
- Method: `GET`
- Auth: Header Auth (Bearer token tècnic Directus).
- Sortida: `data` = referit complet (inclou `client_name`, `client_phone`, `client_email`,
  `notes`, `service`, `odo_opportunity_id`, `odoo_sync_status`).

### 3.3 IF — idempotència (ja sincronitzat?)
- Condició: `{{ $json.data.odo_opportunity_id }}` **is empty** → True = continua.
- False = FI (l'oportunitat ja existeix; no duplicar).

### 3.4 HTTP Request — GET servei (Directus) — per a `expected_revenue`
- URL: `{{ $variables.DIRECTUS_URL }}/items/services/{{ $json.data.service }}`
- Method: `GET`, mateixa auth.
- Guarda `alta_fee = {{ $json.data.alta_fee }}`.

> Si `alta_fee` és `null` (servei «a mida»), `expected_revenue` es deixa buit.

### 3.5 HTTP Request — Odoo authenticate (JSON-RPC)
- URL: `{{ $variables.ODOO_URL }}/jsonrpc`
- Method: `POST`, Content-Type `application/json`
- Body:
  ```json
  {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "service": "common",
      "method": "authenticate",
      "args": ["{{ $variables.ODOO_DB }}", "{{ $variables.ODOO_LOGIN }}", "{{ $variables.ODOO_APIKEY }}"]
    }
  }
  ```
- Resultat: `result` = **uid** (enter). Guarda `uid`.

### 3.6 HTTP Request — Odoo search crm.lead (idempotència en reintents)
- URL: `{{ $variables.ODOO_URL }}/jsonrpc`, POST.
- Body:
  ```json
  {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "service": "object",
      "method": "execute_kw",
      "args": [
        "{{ $variables.ODOO_DB }}",
        "{{ $json.uid }}",
        "{{ $variables.ODOO_APIKEY }}",
        "crm.lead",
        "search",
        [["name", "=like", "{{ $json.data.referral_code }}%"]],
        {"limit": 1}
      ]
    }
  }
  ```
- Resultat: `result` = array d'ids (buit si no existeix). Guarda `lead_id`.

> **Per què `name` = `REF-XXXX%`?** `crm.lead` no té camp `ref` estàndard. El codi del
> PRM es posa al **principi del `name`** (pas 3.7), de manera que la cerca per prefix és
> determinista i funciona en qualsevol versió. Alternativa (opcional): camp `x_*` creat a
> Odoo Studio per guardar-hi el codi i cercar-hi.

### 3.7 IF — el lead ja existeix a Odoo?
- `{{ $json.lead_id }}` (array) **is empty** → True = crear (3.8). False = saltar a 3.9 (reusar `lead_id[0]`).

### 3.8 HTTP Request — Odoo create crm.lead
- URL: `{{ $variables.ODOO_URL }}/jsonrpc`, POST.
- Body:
  ```json
  {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "service": "object",
      "method": "execute_kw",
      "args": [
        "{{ $variables.ODOO_DB }}",
        "{{ $json.uid }}",
        "{{ $variables.ODOO_APIKEY }}",
        "crm.lead",
        "create",
        [{
          "name": "{{ $json.data.referral_code }} · {{ $json.data.client_name }}",
          "phone": "{{ $json.data.client_phone }}",
          "email_from": "{{ $json.data.client_email }}",
          "description": "{{ $json.data.notes }}",
          "expected_revenue": "{{ $json.alta_fee }}"
        }]
      ]
    }
  }
  ```
- Resultat: `result` = **id del lead** (enter). Guarda `lead_id`.

> El `name` es composa amb el codi al davant per permetre la cerca d'idempotència.
> Si el client vol el nom net, o bé es neteja després del sync o s'usa un camp `x_*`.

### 3.9 HTTP Request — PATCH referit (Directus) — write-back
- URL: `{{ $variables.DIRECTUS_URL }}/items/referrals/{{ $json.referral_id }}`
- Method: `PATCH`
- Body:
  ```json
  {
    "odo_opportunity_id": {{ $json.lead_id[0] }},
    "odoo_sync_status": "ok"
  }
  ```
- `odo_customer_id` / `odo_sale_id` es deixen **null** (no es crea `res.partner` a l'alta).

### 3.10 HTTP Request — POST odoo_sync_log (Directus) — auditoria
- URL: `{{ $variables.DIRECTUS_URL }}/items/odoo_sync_log`
- Method: `POST`
- Body:
  ```json
  {
    "entity": "referral",
    "entity_id": "{{ $json.referral_id }}",
    "action": "create_opportunity",
    "odoo_operation": "crm.lead.create",
    "status": "ok",
    "error": null,
    "attempts": 0
  }
  ```

### 3.11 Maneig d'errors
En qualsevol fallada del sub-workflow:
1. **PATCH** referit: `{ "odoo_sync_status": "error" }`.
2. **POST** `odoo_sync_log`: `{ entity:'referral', entity_id, action:'create_opportunity',
   odoo_operation, status:'error', error:'<missatge>', attempts:<n> }`.

En n8n, es pot fer amb:
- Un **Error Trigger** en un workflow separat que rep l'error i executa els PATCH/POST, o
- Connectar les sortides d'error del nodo Execute Workflow (Workflow B/C) a un sub-workflow `odoo_sync_error`.

> **IMPORTANT:** l'ordre PATCH-referral → log és invertit en cas d'error: primer es marca
> `odoo_sync_status='error'` i després es registra. El workflow **C** (cron) detectarà els
> `pendiente`/`error` i tornarà a intentar-ho.

---

## 4. Workflow C — `sync_retry` (xarxa de seguretat)

**Trigger:** nodo **Schedule Trigger**, cron `*/15 * * * *` (cada 15 min).

Cobreix els casos en què n8n estava caigut quan arribà el NOTIFY (LISTEN és efímer).

1. **Nodo Postgres** (credential rol `n8n`):
   ```sql
   SELECT id, referral_code, odoo_sync_status, updated_at
   FROM referrals
   WHERE odoo_sync_status IN ('pendiente', 'error')
     AND created_at > NOW() - INTERVAL '7 days'
   ORDER BY updated_at
   LIMIT 100;
   ```
   (Finestra de 7 dies per no reprocessar registres antics.)

2. **Nodo Execute Workflow** → `process_referral`, mode **Execute once per incoming item**,
   payload `{ "referral_id": "{{ $json.id }}" }`.

---

## 5. Notes operatives

- **Quan es crearà la `crm.lead`?** Al mateix moment del registre del referit (INSERT a
  `referrals`), via LISTEN. Alta immediata (decisió CEO).
- **Transicions futures** (`aceptado` → `sale.order`/pressupost, `instalado`, callback mensual
  de `active_subscription`, §6.3.2/6.3.3): reutilitzar el mateix patró — ampliar el trigger a
  `AFTER UPDATE OF status` amb `event='referral.status_changed'` i nous sub-workflows a n8n.
- **RGPD:** el NOTIFY només porta `id` + `referral_code`. Les dades personals viatgen per la
  API de Directus (interna) i cap a Odoo (finalitat: CRM). El portal de partners **mai** les exposa.
- **Escalabilitat:** cap limitació de flows de Directus; tota la lògica és a n8n.

---

## 6. Checklist de verificació

1. [ ] Aplicada la migració 07 (superusuari, pgAdmin): trigger + enum + rol `n8n`.
2. [ ] `ALTER ROLE n8n WITH LOGIN PASSWORD '...';` i credencial Postgres a n8n.
3. [ ] Creat usuari tècnic `n8n@polser.cat` (rol `POLSER_admin`) + static token a Directus.
4. [ ] Credencials Directus i Odoo afegides a n8n; variables `ODOO_*`/`DIRECTUS_URL` definides.
5. [ ] Activar workflow B → registrar un referit des del portal (onboarding) → comprovar
      execució a n8n.
6. [ ] Verificar a Odoo que s'ha creat el `crm.lead` amb `name = REF-XXXX · ...` i
      `expected_revenue` = `alta_fee`.
7. [ ] Verificar al PRM: `referrals.odo_opportunity_id` set i `odoo_sync_status='ok'`;
      entrada `odoo_sync_log` `status='ok'`.
8. [ ] Prova d'idempotència: forçar `odoo_sync_status='pendiente'` en un referit ja sincronitzat
      i executar `sync_retry` → no ha de duplicar el lead.
9. [ ] Prova d'error: URL Odoo errònia → `odoo_sync_status='error'` + log failed → corregir →
      el cron el reprocessa.