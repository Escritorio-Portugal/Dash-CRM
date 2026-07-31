# Pablo Mendes Advocacia — Controlo Geral (CRM)

Painel interno de controlo de vendas, recorrências, comissões e financeiro do escritório, construído como uma aplicação web autônoma (um único ficheiro HTML) ligada a uma base de dados Supabase partilhada.

> Este é um sistema **interno e privado**. Não publique o link do painel nem este repositório publicamente — ver [Segurança](#segurança-e-limitações-conhecidas) abaixo.

## Funcionalidades

- **Visão Geral** — meta do mês, faturamento recebido, pendências, recorrência em andamento, taxa de conversão.
- **Recorrências** — criar/excluir contratos recorrentes, com valor de entrada + parcelas, e marcar cada parcela como paga.
- **Vendas** — registo de vendas avulsas (não recorrentes).
- **Ranking** — comparativo de faturamento, ticket médio, comissão e conversão entre vendedores.
- **Perfil do vendedor** — estatísticas individuais, funil manual (conversas/contatos/fechamentos), definir senha de acesso, ativar/desativar.
- **Configurações** — catálogo de serviços (honorário base, IVA, taxa administrativa) e regra de comissão.
- **Financeiro** — custos fixos/variáveis, impostos devidos (calculados proporcionalmente ao valor efetivamente recebido), lucro líquido estimado.
- **Dois perfis de acesso**:
  - **Gestor(a)** — acesso total, login com e-mail/senha (Supabase Auth).
  - **Colaborador(a)** — vê apenas as suas próprias vendas, recorrências e comissões; pode registar novas recorrências, que alimentam automaticamente a visão do gestor. Login próprio com e-mail/senha (Supabase Auth), gerido pelo gestor no painel do Supabase.

## Estrutura do repositório

```
├── index.html               # aplicação completa (HTML + CSS + JS num único ficheiro)
├── vercel.json              # configuração mínima para deploy estático na Vercel
├── supabase/
│   ├── schema.sql               # script base: cria a tabela app_state
│   └── migration_v2_auth_rls.sql # migração de segurança: Supabase Auth + RLS por utilizador
├── docs/
│   ├── CHANGELOG.md            # histórico de versões
│   ├── DEPLOY_CHECKLIST.md     # passo a passo para publicar sem erros
│   └── SECURITY_MIGRATION.md   # passo a passo da migração de segurança v2
└── README.md
```

> Antes de qualquer deploy, siga o [`docs/DEPLOY_CHECKLIST.md`](docs/DEPLOY_CHECKLIST.md) — ele cobre, em ordem, os pontos que já causaram problema antes (arquivo fora da raiz, configuração da Vercel, etc.).

> O ficheiro chama-se `index.html` e fica na raiz do repositório de propósito — é o nome e o local que o GitHub Pages procura automaticamente. Se você tentar abrir o `.html` diretamente pela página do GitHub (ou por um link `raw.githubusercontent.com`), o navegador vai **baixar o ficheiro em vez de o mostrar** — isso é comportamento normal do GitHub, não um erro do projeto. Para ver o painel funcionando de verdade, use o GitHub Pages (próxima secção).

## Como publicar com GitHub Pages

1. Suba este repositório para o GitHub (`git push`).
2. No repositório, vá em **Settings → Pages**.
3. Em "Build and deployment", escolha **Deploy from a branch**.
4. Branch: **main**, pasta: **/ (root)**. Clique em **Save**.
5. Espere um minuto e acesse `https://SEU_USUARIO.github.io/NOME_DO_REPO/` — é lá que o painel aparece como página de verdade, não como download.

## Como publicar com Vercel (alternativa)

Se o link da Vercel estiver **baixando o `index.html` em vez de o exibir**, o problema quase sempre é o projeto ter sido detetado com um "Framework Preset" errado (ex.: Node/Express), fazendo a Vercel tentar rodar um build que não existe. Para corrigir:

1. No projeto na Vercel, vá em **Settings → General**.
2. **Framework Preset**: mude para **Other**.
3. **Root Directory**: deixe vazio / `./` (a raiz do repositório, onde está o `index.html`).
4. **Build Command** e **Output Directory**: deixe em branco (não há build — é HTML puro).
5. Vá em **Deployments**, abra o menu do deployment mais recente e clique em **Redeploy**.

Este repositório já inclui um `vercel.json` mínimo (`cleanUrls: true`) para reforçar que ele deve ser servido como site estático.

## Como implantar

1. **Criar o projeto Supabase** (se ainda não tiver um) em [supabase.com](https://supabase.com).
2. **Rodar o schema base**: abra o SQL Editor do projeto e execute [`supabase/schema.sql`](supabase/schema.sql).
3. **Rodar a migração de segurança v2** (Supabase Auth + RLS por utilizador): execute [`supabase/migration_v2_auth_rls.sql`](supabase/migration_v2_auth_rls.sql) e siga o passo a passo em [`docs/SECURITY_MIGRATION.md`](docs/SECURITY_MIGRATION.md) para criar as contas de login.
4. **Configurar as credenciais**: abra `index.html` e localize as constantes `SUPABASE_URL` e `SUPABASE_KEY` perto do topo do `<script>`. Substitua pelos valores do seu projeto (Project Settings → API → Project URL / anon public key — esta chave é pública por natureza, a segurança vem do RLS, não de a esconder).
5. **Abrir o ficheiro**: `index.html` pode ser hospedado em qualquer servidor estático (GitHub Pages, Netlify, Vercel, etc.).
6. Na primeira abertura (com uma sessão de gestor), o painel encontra a tabela `app_state` vazia e semeia-a automaticamente com os dados iniciais.

## Modelo de dados

Em vez de tabelas relacionais separadas, os dados ficam guardados como blobs JSON numa única tabela chave/valor (`app_state`). Desde a v2, a granularidade da chave varia conforme quem pode acessar o quê:
- `crm:sellers`, `crm:services`, `crm:meta` — partilhados (leitura para qualquer autenticado, escrita só do gestor).
- `crm:costs` — exclusivo do gestor (leitura e escrita).
- `crm:sales:<sellerId>`, `crm:recurrences:<sellerId>`, `crm:funil:<sellerId>` — uma linha por vendedor, com RLS restringindo cada colaborador à sua própria linha.

Essa escolha (chave/valor em vez de tabelas relacionais) simplificou a migração de `window.storage` para Supabase sem reescrever a lógica da aplicação. O custo é não conseguir fazer consultas SQL diretas sobre os dados — se isso vier a ser necessário (relatórios, BI), migrar para tabelas relacionais é o próximo passo natural.

## Contas de acesso

Desde a v2, o login é feito com **e-mail e senha reais, verificados pelo
Supabase Auth** — não há mais nenhuma senha guardada ou comparada dentro do
`index.html`. Criar/editar/remover contas é feito no painel do Supabase
(Authentication → Users), ligado a um papel (gestor/colaborador) pela tabela
`profiles`. Ver o passo a passo completo em
[`docs/SECURITY_MIGRATION.md`](docs/SECURITY_MIGRATION.md).

## Segurança e limitações conhecidas

Este projeto foi desenhado para uso interno, entre pessoas de confiança.
Desde a v2 (Supabase Auth + RLS por utilizador):

1. **As senhas são verificadas no servidor** (Supabase Auth), não mais no navegador — não existe nenhuma senha guardada em texto simples no código nem nos dados.
2. **As políticas do Supabase (RLS) exigem sessão autenticada** para qualquer leitura ou escrita — a chave `anon`/`publishable` sozinha não dá mais acesso a nada. Um colaborador só consegue ler/escrever as **suas próprias** vendas, recorrências e funil diário; o financeiro (custos) é exclusivo do gestor.
3. **Ainda não faça o repositório público** enquanto ele contiver a chave do Supabase — ela continua a ser necessária para inicializar o cliente (é uma chave pública por definição, mas revelar a URL do projeto sem necessidade não traz benefício).
4. Ver [`supabase/migration_v2_auth_rls.sql`](supabase/migration_v2_auth_rls.sql) para o detalhe exato das políticas de RLS aplicadas.

## Modelo de dados

Em vez de tabelas relacionais separadas, os dados ficam guardados como blobs JSON numa única tabela chave/valor (`app_state`), com uma chave por "coleção" (`crm:sellers`, `crm:sales`, `crm:recurrences`, `crm:services`, `crm:costs`, `crm:meta`). Essa escolha simplificou a migração de `window.storage` para Supabase sem reescrever a lógica da aplicação. O custo é não conseguir fazer consultas SQL diretas sobre os dados — se isso vier a ser necessário (relatórios, BI), migrar para tabelas relacionais é o próximo passo natural.

## Regras de negócio implementadas

- **Comissão**:
  - Venda integral (avulsa) ou entrada de uma recorrência: desconta-se o IVA do valor recebido; a comissão é o percentual configurado sobre o que sobra.
  - Parcelas de uma recorrência (marcadas manualmente como pagas): desconta-se o IVA da parcela **e** a fatia da taxa administrativa do contrato diluída pelo nº de parcelas; a comissão é o percentual configurado sobre o restante.
  - Percentuais configuráveis em Configurações → Regras de comissão (padrão: 10% de comissão, 23% de IVA).
- **Imposto devido** (IVA + taxa administrativa, na secção Financeiro) é calculado proporcionalmente ao valor **efetivamente recebido** de cada venda/recorrência — não sobre o valor total contratado.
- **Recorrência com entrada**: o valor de entrada é considerado recebido no ato; o restante do contrato é dividido igualmente pelo número de parcelas.
