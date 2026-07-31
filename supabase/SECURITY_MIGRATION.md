# Migração de segurança v2 — Supabase Auth real + RLS por utilizador

Este documento é o passo a passo para sair do modelo antigo (senhas verificadas
no navegador, qualquer pessoa com a chave `anon` lê/escreve tudo) para o
modelo novo: **login real do Supabase Auth**, verificado no servidor, com
**RLS restringindo cada leitura/escrita ao próprio utilizador autenticado**.

Leia isto inteiro antes de começar. É seguro fazer com o painel em produção,
mas há uma ordem certa — se pular um passo, os colaboradores ficam sem
conseguir entrar até você terminar.

## Antes de começar

- Isto muda **quem consegue aceder aos dados**, não a aparência nem as
  funcionalidades do painel. Depois da migração, o painel funciona
  exatamente igual — só o login muda de "escolher papel + senha" para
  "e-mail + senha real".
- Precisa de acesso de dono/administrador ao projeto Supabase (SQL Editor e
  Authentication).
- Reserve uns 15–20 minutos, sem pressa.

## Passo 1 — Rodar o SQL de migração

1. Abra o teu projeto em [supabase.com](https://supabase.com) → **SQL Editor**.
2. Abra o ficheiro [`supabase/migration_v2_auth_rls.sql`](../supabase/migration_v2_auth_rls.sql)
   deste repositório, copie o conteúdo inteiro e cole no SQL Editor.
3. Clique em **Run**.
4. No final, deve aparecer uma sequência de mensagens `NOTICE: Migrado
   vendedor ...` — uma por cada vendedor cadastrado. Isso confirma que os
   dados de vendas/recorrências/funil de cada um já foram separados em
   linhas próprias (é isso que permite ao RLS restringir por vendedor).

Este script pode ser rodado mais de uma vez sem problema (ele substitui as
políticas antigas e refaz a separação de dados do zero a cada execução).

## Passo 2 — Criar as contas de login (uma por pessoa)

No Supabase: **Authentication → Users → Add user**.

Para **cada pessoa** que usa o painel (o gestor e cada colaborador):

1. Clique em **Add user** → **Create new user**.
2. Preencha um e-mail (pode ser fictício, tipo `larissa@escritorio.local`,
   não precisa ser um e-mail real que recebe correio — só tem de ser único).
3. Defina uma senha (esta é a senha real, verificada pelo servidor).
4. Marque **Auto Confirm User** (assim não precisa de e-mail de confirmação).
5. Clique em **Create user**.
6. **Copie o UUID** que aparece na lista de utilizadores ao lado do e-mail
   criado — vai precisar dele no próximo passo.

Repita para todas as pessoas.

## Passo 3 — Ligar cada conta a um papel (tabela `profiles`)

Ainda no **SQL Editor**, para **cada pessoa** criada no passo 2, rode:

**Para o gestor:**
```sql
insert into profiles (id, role, nome)
values ('COLE-AQUI-O-UUID-DO-GESTOR', 'gestor', 'Nome do gestor');
```

**Para cada colaborador**, usando o `id` do vendedor já existente no painel
(vê em Configurações → Vendedores, coluna "ID (p/ profiles)"):
```sql
insert into profiles (id, role, seller_id, nome)
values ('COLE-AQUI-O-UUID-DA-LARISSA', 'colaborador', 'larissa', 'Larissa');
```

Repita trocando o UUID, o `seller_id` (o ID exato que aparece na tabela de
Vendedores) e o nome, uma vez para cada colaborador.

## Passo 4 — Publicar a função "Criar conta" (opcional, mas recomendado)

O painel agora tem um botão **Criar conta** (no perfil de cada vendedor e em
Configurações → Vendedores) que cria a conta de login sem você precisar ir
ao Supabase manualmente. Isso exige publicar uma Edge Function — sem ela, o
botão continua existindo mas mostra um erro ao clicar (nada quebra, só essa
funcionalidade específica fica indisponível até publicar).

Precisa da [Supabase CLI](https://supabase.com/docs/guides/cli) instalada.
No terminal, dentro da pasta do projeto:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF   # está na URL do projeto no dashboard
supabase functions deploy create-user
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=COLE_AQUI_A_SERVICE_ROLE_KEY
```

A **service_role key** fica em Project Settings → API → "service_role
secret" — é diferente da chave publishable/anon que já está no
`index.html`. **Nunca** cole essa chave no `index.html` nem em nenhum
ficheiro que vá para o navegador: ela dá acesso total ao banco, ignorando
todo o RLS que acabámos de configurar. Ela só deve existir como secret
desta função, guardada pelo próprio Supabase.

Depois de publicada, o botão "Criar conta" passa a funcionar normalmente —
o gestor preenche nome, e-mail e senha, escolhe o papel (e o vendedor, se
for colaborador), e a conta já nasce pronta pra entrar.

## Passo 5 — Publicar o `index.html` novo

Suba o `index.html` desta entrega para o teu repositório/hospedagem, como
sempre (substituir o ficheiro e aguardar o redeploy).

## Passo 6 — Testar

1. Abra o painel. Deve aparecer a tela de login com campos de **e-mail** e
   **senha** (não mais "Sou gestor(a) / Sou colaborador(a)").
2. Entre com o e-mail/senha do gestor — deve abrir a Visão Geral normalmente,
   com todos os dados.
3. Entre (numa aba anônima, ou depois de sair) com o e-mail/senha de um
   colaborador — deve abrir direto em "Minhas Vendas", só com os dados dele.
4. Confirme que um colaborador **não** vê Financeiro, Configurações nem os
   dados de outro colaborador em lugar nenhum.

## Passo 7 — Confirmar e limpar (opcional, mas recomendado)

O script do Passo 1 **não apaga** as chaves antigas (`crm:sales`,
`crm:recurrences` sem sufixo de vendedor) — só cria as novas, por segurança,
para você poder validar antes de remover algo. Depois de confirmar que tudo
no Passo 5 está correto, pode limpar as antigas rodando isto no SQL Editor:

```sql
delete from app_state where key in ('crm:sales', 'crm:recurrences');
```

Isso não afeta o painel (ele já não lê mais essas chaves desde a v2) — só
libera espaço e evita confusão futura.

## Gerir contas depois da migração

- **Criar um novo colaborador**: primeiro adicione o vendedor no painel
  (Configurações → Vendedores → Adicionar), copie o ID que aparece, depois
  repita os Passos 2 e 3 para essa pessoa.
- **Redefinir a senha de alguém**: Supabase → Authentication → Users →
  clique nos "..." ao lado da pessoa → **Send password recovery** (se o
  e-mail for real) ou **Reset password** manualmente.
- **Revogar o acesso de alguém**: Supabase → Authentication → Users → "..."
  → **Delete user**. A linha em `profiles` fica órfã (pode apagar também,
  não é obrigatório) e a pessoa perde o acesso imediatamente.

## O que mudou tecnicamente (para quem for mexer no código depois)

- `index.html` agora carrega o `supabase-js` (via CDN) e usa
  `supa.auth.signInWithPassword()` para autenticar — não há mais nenhuma
  senha guardada ou comparada dentro do próprio ficheiro.
- O papel (gestor/colaborador) e, se for colaborador, o vendedor
  correspondente vêm da tabela `profiles`, lida com `auth.uid()` — nunca do
  cliente.
- As chaves `crm:sales`/`crm:recurrences` (um blob único, todos os
  vendedores misturados) viraram `crm:sales:<sellerId>` /
  `crm:recurrences:<sellerId>` / `crm:funil:<sellerId>` — uma linha por
  vendedor, cada uma com a sua própria política de RLS.
- `crm:sellers`, `crm:services` e `crm:meta` continuam partilhados (leitura
  para qualquer autenticado, escrita só para gestor). `crm:costs` é
  gestor-only nos dois sentidos.
- As migrações de correção de dados (`applyHistoricalImport`,
  `applyCorrigeEntradaRecorrencias2026`, etc.) só rodam quando quem faz
  login é o gestor — um colaborador não tem permissão de escrita ampla o
  suficiente para elas de qualquer forma, e não faz sentido elas tentarem
  rodar a cada login de colaborador.
- O botão "Criar conta" chama uma Edge Function (`supabase/functions/create-user`)
  que usa a chave `service_role` — **essa chave só existe no servidor**
  (como secret da função), nunca no `index.html`. A função confirma, no
  servidor, que quem está a chamar é mesmo o gestor antes de criar
  qualquer conta.
