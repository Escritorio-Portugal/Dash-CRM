// ============================================================
// Edge Function: create-user
//
// Cria uma conta de login (Supabase Auth) + a linha correspondente
// em "profiles", chamada pelo botão "Criar conta" do painel.
//
// PORQUÊ ISTO PRECISA SER UMA EDGE FUNCTION (e não só JS no index.html):
//   Criar um utilizador de Auth para OUTRA pessoa exige a chave
//   "service_role" do Supabase — essa chave ignora TODAS as
//   políticas de RLS (é a chave de administrador do projeto). Se ela
//   fosse colocada dentro do index.html (client-side), qualquer
//   pessoa que abrisse o painel poderia extraí-la do código-fonte e
//   teria acesso total e irrestrito à base de dados inteira — ou
//   seja, desfaria completamente a migração de segurança feita antes
//   (Supabase Auth + RLS por utilizador).
//
//   Por isso a chave service_role só existe AQUI, guardada como
//   variável de ambiente ("secret") desta função — nunca chega ao
//   navegador. O painel (index.html) chama esta função pela internet,
//   autenticado com a sessão da pessoa que está logada; esta função
//   confirma no servidor que quem está a chamar é mesmo o gestor
//   antes de fazer qualquer coisa.
//
// DEPLOY (uma vez só, precisa da Supabase CLI):
//   supabase functions deploy create-user
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<a service_role key do projeto>
//   (SUPABASE_URL já fica disponível automaticamente dentro da função)
//
// Ver docs/SECURITY_MIGRATION.md para o passo a passo completo.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerJwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!callerJwt) {
      return json({ error: "Sem sessão — faça login antes de tentar criar uma conta." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente "de quem chamou" — usa a sessão dele, sujeito a RLS normal.
    // Só serve pra confirmar, com segurança, que quem está a chamar é
    // mesmo quem diz ser (e que é gestor) antes de usar o cliente admin.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${callerJwt}` } },
    });
    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) {
      return json({ error: "Sessão inválida ou expirada." }, 401);
    }
    const { data: callerProfile } = await callerClient
      .from("profiles").select("role").eq("id", callerUser.id).maybeSingle();
    if (!callerProfile || callerProfile.role !== "gestor") {
      return json({ error: "Só o gestor pode criar contas novas." }, 403);
    }

    const { email, password, role, sellerId, nome } = await req.json();
    if (!email || !password) {
      return json({ error: "E-mail e senha são obrigatórios." }, 400);
    }
    if (!["gestor", "colaborador"].includes(role)) {
      return json({ error: "Papel inválido." }, 400);
    }
    if (role === "colaborador" && !sellerId) {
      return json({ error: "Selecione a qual vendedor esta conta pertence." }, 400);
    }

    // Cliente admin — só existe aqui dentro, nunca é enviado ao navegador.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (createErr) {
      return json({ error: `Não consegui criar o utilizador: ${createErr.message}` }, 400);
    }

    const { error: profileErr } = await adminClient.from("profiles").insert({
      id: created.user.id,
      role,
      seller_id: role === "colaborador" ? sellerId : null,
      nome: nome || null,
    });
    if (profileErr) {
      // Se o perfil falhar, desfaz a criação do utilizador pra não deixar
      // uma conta "órfã" (login sem perfil, que ficaria travada ao entrar).
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json({ error: `Não consegui criar o perfil: ${profileErr.message}` }, 400);
    }

    return json({ ok: true, userId: created.user.id });
  } catch (e) {
    return json({ error: `Erro inesperado: ${e?.message || e}` }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
