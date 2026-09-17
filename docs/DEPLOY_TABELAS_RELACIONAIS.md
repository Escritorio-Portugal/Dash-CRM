# Deploy: vendas/recorrências em tabelas relacionais

Passo a passo pra publicar a mudança que tira vendas e recorrências do
blob JSON e coloca em tabelas de verdade. Faça na ordem — cada passo
depende do anterior ter dado certo.

## 1. Rodar o SQL no Supabase (se ainda não rodou, ou pra atualizar)

No SQL Editor do projeto, cole e rode, **nessa ordem**:

1. `supabase/migration_v5_tabelas_vendas_recorrencias.sql`
   Cria as tabelas (se não existirem), aplica a segurança (RLS), e
   importa pra elas tudo que hoje está no formato antigo. É seguro
   rodar de novo mesmo que já tenha rodado antes — ele atualiza em
   vez de duplicar, e pega qualquer venda/recorrência lançada desde a
   última vez.

2. Confirme com a consulta de verificação (não está mais nos arquivos
   anexados desta vez, mas está no histórico da conversa — ou peça de
   novo). O que precisa bater: `total_vendas_tabela_nova` ==
   `total_vendas_blob_antigo`, e o mesmo para recorrências. Se não
   bater, me avise antes de continuar — **não segue pro passo 2 sem
   isso bater certo.**

## 2. Substituir o index.html

1. No GitHub, abra `index.html` na raiz do repositório.
2. Substitua o conteúdo inteiro pelo do arquivo `index.html` anexado
   nesta entrega (é o antigo `index_v2_tabelas_relacionais.html`, já
   renomeado pra ir direto no lugar certo).
3. Commit. O Vercel publica sozinho a partir daqui.

## 3. Depois de publicado — teste rápido no ar

Faça isso antes de considerar concluído:

- [ ] Entrar como **gestor**: a lista de Vendas e Recorrências aparece
      igual a antes (mesmos números).
- [ ] Entrar como **colaborador**: "Minhas Vendas" mostra só as dele,
      igual a antes.
- [ ] Lançar uma **venda de teste** pequena, confirmar que aparece na
      lista na hora.
- [ ] Marcar uma **parcela como paga** numa recorrência de teste,
      confirmar que atualiza certo.
- [ ] Apagar a venda/recorrência de teste depois de confirmar (pra não
      sujar os dados reais).

## Se algo der errado

O blob antigo (`crm:sales:<id>` / `crm:recurrences:<id>` em
`app_state`) **não foi apagado** por nenhum dos passos acima. Se
precisar reverter, basta voltar o `index.html` pro commit anterior no
GitHub — o painel volta a ler do blob antigo, que continua intacto e
atualizado até o momento da troca (mas não recebe gravações novas
feitas depois da troca, então reverter só é seguro fazer logo em
seguida, não dias depois).
