// Gestión de cuentas (solo entrenador/administrador).
// La plataforma es privada: no hay registro público. El entrenador crea las
// cuentas de jugadores y encargados desde aquí. La clave secreta solo existe
// en el servidor (ctx.supabaseAdmin) y nunca llega al navegador.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Role = "admin" | "player" | "guardian";

interface CreateInput {
  action: "create";
  email: string;
  password: string;
  full_name: string;
  role: Role;
  /** Rol jugador: expediente que se vincula a la cuenta. */
  player_id?: string;
  /** Rol encargado: jugadores que puede consultar. */
  player_ids?: string[];
  phone?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  const admin = ctx.supabaseAdmin;
  const callerId = ctx.userClaims?.id;
  if (!callerId) return json({ error: "No autenticado" }, 401);

  // Autorización real: el perfil del llamante debe ser admin activo.
  const { data: caller } = await admin.from("profiles").select("role, active").eq("id", callerId).maybeSingle();
  if (!caller || caller.role !== "admin" || !caller.active) {
    return json({ error: "Solo el entrenador puede gestionar cuentas" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Solicitud no válida" }, 400);
  }

  switch (body.action) {
    case "list": {
      const { data: profiles, error } = await admin
        .from("profiles")
        .select("id, full_name, role, active, created_at")
        .order("full_name");
      if (error) return json({ error: error.message }, 500);
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const emails = new Map(users?.users.map((u) => [u.id, u.email]) ?? []);
      const { data: players } = await admin.from("players").select("id, first_name, last_names, user_id").not("user_id", "is", null);
      const { data: guardians } = await admin
        .from("guardians")
        .select("id, profile_id, player_guardians(player_id, authorized, players(first_name, last_names))")
        .not("profile_id", "is", null);
      return json({
        accounts: (profiles ?? []).map((p) => ({
          ...p,
          email: emails.get(p.id) ?? null,
          player: players?.find((x) => x.user_id === p.id) ?? null,
          guardian: guardians?.find((g) => g.profile_id === p.id) ?? null,
        })),
      });
    }

    case "create": {
      const input = body as unknown as CreateInput;
      const email = String(input.email ?? "").trim().toLowerCase();
      const fullName = String(input.full_name ?? "").trim();
      if (!EMAIL_RE.test(email)) return json({ error: "Correo no válido" }, 400);
      if (!fullName) return json({ error: "El nombre es obligatorio" }, 400);
      if (typeof input.password !== "string" || input.password.length < 8)
        return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
      if (!["admin", "player", "guardian"].includes(input.role)) return json({ error: "Rol no válido" }, 400);
      if (input.role === "player" && !input.player_id) return json({ error: "Selecciona el expediente del jugador" }, 400);
      if (input.role === "player") {
        const { data: pl } = await admin.from("players").select("id, user_id").eq("id", input.player_id!).maybeSingle();
        if (!pl) return json({ error: "Expediente no encontrado" }, 404);
        if (pl.user_id) return json({ error: "Ese jugador ya tiene una cuenta" }, 409);
      }

      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        // El rol vive en app_metadata (no editable por el usuario) y en profiles.
        app_metadata: { role: input.role },
        user_metadata: { full_name: fullName },
      });
      if (authErr || !created.user) return json({ error: authErr?.message ?? "No se pudo crear la cuenta" }, 400);
      const uid = created.user.id;

      const rollback = async (msg: string) => {
        await admin.auth.admin.deleteUser(uid);
        return json({ error: msg }, 500);
      };

      const { error: pErr } = await admin.from("profiles").insert({ id: uid, full_name: fullName, role: input.role });
      if (pErr) return rollback(pErr.message);

      if (input.role === "player") {
        const { error } = await admin.from("players").update({ user_id: uid }).eq("id", input.player_id!).is("user_id", null);
        if (error) return rollback(error.message);
      }
      if (input.role === "guardian") {
        const { data: g, error } = await admin
          .from("guardians")
          .insert({ profile_id: uid, full_name: fullName, email, phone: input.phone ?? null })
          .select("id")
          .single();
        if (error) return rollback(error.message);
        const ids = Array.isArray(input.player_ids) ? input.player_ids : [];
        if (ids.length) {
          const { error: lErr } = await admin
            .from("player_guardians")
            .insert(ids.map((player_id) => ({ player_id, guardian_id: g.id, authorized: true })));
          if (lErr) return rollback(lErr.message);
        }
      }
      await admin.from("activity_logs").insert({
        actor_id: callerId,
        action: "insert",
        entity: "profiles",
        entity_id: uid,
        summary: `Cuenta creada (${input.role === "player" ? "jugador" : input.role === "guardian" ? "encargado" : "administrador"}): ${fullName}`,
      });
      return json({ id: uid });
    }

    case "set_active": {
      const userId = String(body.user_id ?? "");
      const active = Boolean(body.active);
      if (userId === callerId && !active) return json({ error: "No puedes desactivar tu propia cuenta" }, 400);
      const { error } = await admin.from("profiles").update({ active }).eq("id", userId);
      if (error) return json({ error: error.message }, 500);
      // Bloquea también el inicio de sesión; las sesiones activas pierden acceso por RLS (profiles.active).
      await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
      if (!active) await admin.auth.admin.signOut(userId).catch(() => undefined);
      return json({ ok: true });
    }

    case "reset_password": {
      const userId = String(body.user_id ?? "");
      const password = String(body.password ?? "");
      if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    default:
      return json({ error: "Acción no reconocida" }, 400);
  }
});

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    const res = await handler(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
};
