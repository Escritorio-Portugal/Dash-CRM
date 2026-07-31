# Checklist de deploy — Controlo Geral (Pablo Mendes Advocacia)

Siga esta ordem sempre que for atualizar o painel. A maioria dos problemas que já tivemos (download em vez de abrir, painel vazio, dados não salvando) vem de pular um destes passos.

## 1. Antes de subir pro GitHub

- [ ] O ficheiro principal chama-se **`index.html`** e está na **raiz** do repositório (não dentro de `src/` ou qualquer subpasta).
- [ ] Existe um ficheiro **`vercel.json`** na raiz, ao lado do `index.html`.
- [ ] Abra o `index.html` localmente (duplo clique) uma vez antes de subir — se abrir e funcionar no seu computador, está pronto para subir.

## 2. Subir para o GitHub

```bash
git add -A
git commit -m "descrição do que mudou"
git push
```

- [ ] Depois do push, abra `github.com/SEU_USUARIO/NOME_DO_REPO` no navegador e confirme que `index.html` aparece **listado na raiz**, não dentro de uma pasta.
- [ ] **Nunca** teste clicando no `index.html` dentro da página do GitHub — o GitHub sempre baixa ou mostra código-fonte, nunca renderiza. Isso não é erro, é assim que o GitHub funciona. Quem renderiza é a Vercel (ou o GitHub Pages).

## 3. Configuração da Vercel (só precisa checar 1x por projeto)

No projeto → **Settings → General**:

| Campo | Valor correto |
|---|---|
| Framework Preset | **Other** |
| Root Directory | vazio / `./` |
| Build Command | vazio |
| Output Directory | vazio |

- [ ] Se algum desses campos estiver diferente, corrija e clique em **Save**.

## 4. Publicar

- [ ] Vá em **Deployments** → o deployment mais recente deve corresponder ao último commit que você deu push (confira a mensagem do commit e o horário).
- [ ] Se o deployment mais recente **não corresponder**, clique nos "..." → **Redeploy**.
- [ ] Espere o status mudar para **Ready** (verde).

## 5. Testar o link

- [ ] Abra o link de produção (ex.: `dash-crm-psi.vercel.app`) numa aba anônima/privada — evita que o cache do navegador esconda um problema já corrigido.
- [ ] O painel deve abrir a tela de login (e-mail + senha). Se baixar um ficheiro em vez disso, volte ao passo 3 — normalmente é o Framework Preset.

## 6. Checklist do Supabase (se os dados não salvarem, ou ninguém conseguir entrar)

- [ ] O projeto Supabase está ativo (não pausado por inatividade — projetos gratuitos pausam sozinhos depois de um tempo sem uso).
- [ ] A tabela `app_state` existe (SQL Editor → rodar `select * from app_state;` deve funcionar sem erro).
- [ ] A migração `supabase/migration_v2_auth_rls.sql` já foi executada (SQL Editor → rodar `select * from profiles;` deve funcionar sem erro e mostrar pelo menos uma linha para o gestor).
- [ ] Cada pessoa que usa o painel tem uma conta em **Authentication → Users** e uma linha correspondente em `profiles` (ver `docs/SECURITY_MIGRATION.md`).
- [ ] `SUPABASE_URL` e `SUPABASE_KEY` dentro do `index.html` correspondem ao projeto certo (Project Settings → API).
- [ ] Se aparecer o aviso vermelho de erro no próprio painel, copie o texto exato dele — é a forma mais rápida de eu identificar a causa.

## 7. Se algo continuar errado

Me mande, nessa ordem de prioridade:
1. O texto exato de qualquer erro (do navegador ou do aviso vermelho no painel).
2. A URL exata que você está a testar.
3. Um print da tela de **Settings → General** do projeto na Vercel.

Com isso eu resolvo sem precisar adivinhar.
