// src/index.ts
import { createHash, randomInt } from "node:crypto";
import jwt from "jsonwebtoken";
import { InvalidCredentialsError, InvalidPayloadError } from "@directus/errors";
var OTP_TTL_MS = 10 * 60 * 1e3;
var OTP_MAX_PER_HOUR = 5;
var requests = /* @__PURE__ */ new Map();
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function isRateLimited(email) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1e3;
  const stamps = (requests.get(email) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= OTP_MAX_PER_HOUR) {
    requests.set(email, stamps);
    return true;
  }
  stamps.push(now);
  requests.set(email, stamps);
  return false;
}
function ttlSeconds(value) {
  if (typeof value === "number") return value;
  const match = /^(\d+)(ms|s|m|h|d)?$/.exec(value.trim());
  if (!match) return 900;
  const n = Number(match[1]);
  switch (match[2]) {
    case "ms":
      return Math.round(n / 1e3);
    case "h":
      return n * 3600;
    case "d":
      return n * 86400;
    case "m":
      return n * 60;
    default:
      return n;
  }
}
var src_default = {
  id: "auth-otp",
  handler(router, context) {
    const { database, env, logger, services, getSchema } = context;
    const { MailService } = services;
    router.post("/request-otp", async (req, res, next) => {
      try {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          return next(new InvalidPayloadError({ reason: "Correu electr\xF2nic no v\xE0lid." }));
        }
        if (isRateLimited(email)) {
          return res.status(200).json({ ok: true });
        }
        const user = await database("directus_users").select("id", "email", "status", "role").where("email", email).first();
        const member = user ? await database("partner_members as pm").join("partners as p", "p.id", "pm.partner").select("p.status as partner_status").whereRaw('pm."user" = ?', [user.id]).first() : null;
        const allowed = user && user.status === "active" && member && member.partner_status === "actiu";
        if (!allowed) {
          logger.info(`[auth-otp] sol\xB7licitud per a ${email}: compte no actiu o inexistent`);
          return res.status(200).json({ ok: true });
        }
        const code = String(randomInt(0, 1e6)).padStart(6, "0");
        await database("auth_otps").insert({
          email,
          code_hash: sha256(code),
          expires_at: new Date(Date.now() + OTP_TTL_MS),
          used: false
        });
        await database("auth_otps").where("expires_at", "<", /* @__PURE__ */ new Date()).del();
        await database("auth_otps").where("used", true).where("created_at", "<", new Date(Date.now() - 24 * 60 * 60 * 1e3)).del();
        try {
          const schema = await getSchema();
          const mail = new MailService({ schema, knex: database });
          await mail.send({
            to: email,
            subject: "El teu codi d'acc\xE9s \xB7 Portal Partners POLSER",
            text: `El teu codi d'acc\xE9s \xE9s: ${code}. Caduca en 10 minuts.`,
            html: `<p>El teu codi d'acc\xE9s \xE9s:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>Caduca en 10 minuts.</p>`
          });
        } catch (err) {
          logger.warn(`[auth-otp] no s'ha pogut enviar l'email a ${email}: ${err.message}`);
        }
        logger.info(`[auth-otp] codi generat per a ${email}`);
        if (env.OTP_DEV_REVEAL === "true") {
          return res.status(200).json({ ok: true, code });
        }
        return res.status(200).json({ ok: true });
      } catch (err) {
        return next(err);
      }
    });
    router.post("/verify-otp", async (req, res, next) => {
      try {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
        if (!email || !/^\d{6}$/.test(code)) {
          return next(new InvalidPayloadError({ reason: "Dades no v\xE0lides." }));
        }
        const record = await database("auth_otps").where("email", email).orderBy("created_at", "desc").first();
        const valid = record && !record.used && new Date(record.expires_at).getTime() > Date.now() && record.code_hash === sha256(code);
        if (!valid) {
          throw new InvalidCredentialsError({ reason: "Codi incorrecte o caducat." });
        }
        await database("auth_otps").where("id", record.id).update({ used: true });
        const user = await database("directus_users").select("id", "role").where("email", email).first();
        if (!user) {
          throw new InvalidCredentialsError({ reason: "Usuari no trobat." });
        }
        const ttl = env.ACCESS_TOKEN_TTL || "15m";
        const accessToken = jwt.sign(
          { id: user.id, role: user.role, app_access: false, admin_access: false },
          env.SECRET,
          { expiresIn: ttl, issuer: "directus" }
        );
        return res.status(200).json({ access_token: accessToken, expires: ttlSeconds(ttl) });
      } catch (err) {
        return next(err);
      }
    });
  }
};
export {
  src_default as default
};
