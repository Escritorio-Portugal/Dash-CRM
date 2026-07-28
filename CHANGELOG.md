# Changelog

## v0.8 — Filtros de período e recorrências pagas
- **Visão Geral**: nova barra de filtro por **Mês / Semana / Dia**, com navegação (‹ ›), seletor direto de mês e botão "Hoje". Abaixo dela, uma secção de **Atividade no período** lista cada recebimento (vendas, entradas e parcelas pagas) daquele período, com total recebido, nº de recebimentos, ticket médio e comissão gerada.
- **Recorrências pagas**: nova aba separada. Recorrências 100% quitadas saem automaticamente de "Recorrências" (que agora só mostra as em aberto) e passam a aparecer aqui, organizadas por filtro de mês — o mês usado é o da **última parcela paga**, não o da criação do contrato. Cada linha mostra um resumo: "Entrou em [data], N parcela(s), finalizada em [mês]".
- Os cálculos de período são baseados numa lista de "eventos de recebimento" (cada venda, entrada e parcela paga vira um evento com a sua própria data) — é essa mesma lógica que decide o mês de finalização de uma recorrência.
- **Pendente**: os últimos meses adicionais (dados complementares de meses anteriores) ainda não foram integrados — aguardando as planilhas complementares para preencher abril/maio/junho sem duplicar registos já existentes.

## v0.7 — Nova lógica de cálculo de comissão
- Reformulada a fórmula de comissão para seguir exatamente a regra de negócio real do escritório:
  - **Venda integral** (avulsa) ou **entrada de uma recorrência**: desconta-se o IVA do valor recebido; a comissão é o percentual configurado sobre o que sobra.
  - **Parcelas de uma recorrência** (marcadas manualmente como pagas): desconta-se o IVA da parcela **e** a fatia da taxa administrativa do contrato diluída pelo número de parcelas; a comissão é o percentual configurado sobre o restante.
- Percentual de comissão padrão alterado de 50% para **10%**, e o percentual de IVA (23%) passou a ser efetivamente usado no cálculo (antes só ficava guardado, sem uso real).
- Textos da tela de Configurações → Regras de comissão atualizados para explicar a nova fórmula.
- **Atenção**: quem já tinha uma base Supabase em produção antes desta versão precisa entrar em Configurações → Regras de comissão e ajustar manualmente o percentual para 10% (o valor antigo de 50% permanece salvo até ser alterado ali).

## v0.6 — Correção do deploy na Vercel
- Adicionado `vercel.json` mínimo (`cleanUrls`) para garantir que o site seja servido como página estática, corrigindo o problema em que o link da Vercel baixava o `index.html` em vez de o exibir (a causa raiz costuma ser o **Framework Preset** do projeto na Vercel não estar configurado como "Other" — ver README).

## v0.5 — Correção de estrutura para GitHub Pages
- Ficheiro principal movido de `src/dashboard.html` para `index.html` na raiz do repositório — necessário para que o GitHub Pages sirva o painel como página web em vez de forçar o download do ficheiro.
- README atualizado com passo a passo de como ativar o GitHub Pages.

## v0.4 — Senhas individuais e limpeza de avisos
- Senha de acesso obrigatória ao cadastrar novo colaborador.
- Campo para definir/alterar a senha de qualquer vendedor no perfil individual.
- Login de colaborador agora exige a senha própria quando ela está definida.
- Removido o aviso lateral sobre "dados de exemplo da planilha"; substituído por confirmação de conexão ativa com o Supabase.

## v0.3 — Identidade visual da marca
- Paleta reconstruída com as cores exatas extraídas das logos oficiais (vinho `#520225` e dourado `#BB8E1D`), substituindo a paleta azul-marinho genérica da primeira versão.
- Logos reais (ícone dourado na barra lateral, versão dourado+vinho na tela de login) processadas a partir dos ficheiros fornecidos, com remoção de fundo preto e conversão para PNG transparente.
- Sistema de diagnóstico de erros em tela (aviso vermelho) para facilitar a identificação de falhas futuras.

## v0.2 — Papéis, configurações e financeiro
- Persistência migrada de armazenamento local para Supabase (tabela `app_state`), tornando os dados partilhados entre todos os utilizadores do painel.
- Dois perfis de acesso: Gestor (acesso total) e Colaborador (vê apenas os próprios dados).
- Senha administrativa obrigatória para entrar como gestor.
- Nova secção **Configurações**: catálogo de serviços (honorário base/IVA/taxa administrativa) e regra de comissão configurável.
- Nova secção **Financeiro**: custos fixos/variáveis, cálculo de imposto devido proporcional ao valor recebido, lucro líquido estimado.
- Campo de "valor de entrada" ao criar uma recorrência.

## v0.1 — Primeira versão
- Dashboard inicial extraído da planilha "Controlhe Geral (CRM) — Julho", com dados reais de vendedores, vendas, recorrências, serviços e custos.
- Cards de faturamento, pendências, recorrência ativa e taxa de conversão.
- Gestão de recorrências (criar, excluir, marcar parcela como paga) e de vendedores (adicionar, desativar/reativar).
- Ranking de vendedores por faturamento.
- Persistência local via `window.storage` (sem partilha entre utilizadores).
