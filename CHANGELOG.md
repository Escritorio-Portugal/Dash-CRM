# Changelog

## v0.15 — Funil manual no próprio painel do colaborador
- A seção **"Funil manual"** (conversas iniciadas, novos contatos, fechamentos manuais, taxa de conversão) — que antes só existia na visão do gestor sobre cada vendedor — agora também aparece dentro do **painel do próprio colaborador**, logo abaixo de "Minhas vendas avulsas".
- Cada colaborador pode preencher os seus próprios números diretamente, sem depender do gestor fazer isso por ele.
- Os dois lugares (perfil visto pelo gestor e painel do colaborador) agora usam o mesmo componente e salvam no mesmo campo — preencher em um reflete no outro.

## v0.14 — Filtro de vendedor em Vendas + sidebar sempre no mês corrente
- **Vendas**: novo filtro por **vendedor** (dropdown com só quem tem venda registada), combinável com o filtro de mês/dia já existente.
- **Sidebar (lista de vendedores na lateral)**: agora mostra sempre o **faturamento do mês corrente**, de forma independente do filtro de período usado em Ranking/Visão Geral/perfil do vendedor. Reseta sozinha no dia 1 de cada mês, porque é sempre recalculada a partir da data real, nunca de um filtro salvo.
- A sidebar **nunca mostra a soma total histórica** — isso só aparece dentro do perfil individual do vendedor (e no Ranking), onde agora existe uma aba extra **"Total histórico"** na mini barra de período, para quem quiser ver a produção acumulada de todos os tempos.

## v0.13 — Lançamento rápido de venda/recorrência
- Dois botões de atalho na Visão Geral: **"+ Adicionar venda"** e **"+ Adicionar recorrência"**.
- Ambos abrem o **mesmo modal inteligente**, com um controle no topo (Venda integral / Recorrência) — a pessoa marca o tipo, o formulário muda os campos automaticamente, e ao salvar o sistema já cria o registo na área certa (Vendas ou Recorrências) sem precisar navegar até lá.
- O tipo pode ser trocado dentro do próprio modal a qualquer momento, sem perder o que já foi digitado (cliente, serviço, data).
- Serviço com autocompletar do catálogo, preenchendo o valor automaticamente (igual já acontecia na criação de recorrência).
- Também adicionado o mesmo modal na tela de **Vendas** (que antes não tinha nenhuma forma de cadastrar uma venda avulsa manualmente).

## v0.12 — Correção de duplicidade + Ranking/perfil por período
- **Bug real corrigido**: 4 vendas avulsas (3 da Fernanda, 1 da Larissa) já eram contadas duas vezes — uma vez como "venda avulsa" e outra como a entrada/parcela de uma recorrência com o mesmo cliente e mesma data. Isso inflava o faturamento e a comissão. Removidas do dado semente e de qualquer base já em produção (migração automática, roda uma única vez).
- **Ranking, perfil do vendedor e painel do colaborador agora seguem o mesmo filtro de período da Visão Geral** — antes mostravam sempre a soma de tudo desde sempre, o que fazia um vendedor com vários meses de dados importados parecer ter faturado um valor gigante "num mês só". Agora cada tela tem sua própria mini barra de período (Mês/Semana/Dia), sincronizada com a mesma seleção global.
- O mês inicial mostrado ao abrir o painel passou a ser o mês mais recente com dados reais (em vez do dia real do calendário do computador, que podia não bater com nenhum dado cadastrado).
- **Meta e filtro de período reorganizados**: saíram do corpo da página e foram para o canto superior direito, numa única linha, ocupando ~80% da largura — período, navegação, seletor de mês e o botão de editar meta lado a lado, não mais empilhados.

## v0.11 — Meta ampliada e cards da Visão Geral filtráveis por período
- O seletor de período (Mês/Semana/Dia) saiu do corpo da página e foi pro **canto superior direito**, ao lado da configuração de meta — onde sempre esteve.
- **Meta muito mais visível**: números grandes (valor recebido, valor da meta, percentual), barra de progresso mais alta e destacada com moldura dourada.
- Os 4 cards principais da Visão Geral (**Faturamento recebido, Pendências a receber, Recorrência em andamento, Taxa de conversão**) agora recalculam de acordo com o período selecionado no topo — antes só a secção "Atividade" abaixo dos cards era filtrada, os cards ficavam sempre com o total geral.
- Pendências e recorrência em andamento no período consideram os contratos **originados** naquele mês/semana/dia; taxa de conversão usa os fechamentos do período contra o total de conversas informadas (esse número ainda não tem granularidade diária/mensal nos dados).

## v0.10 — Filtros em Vendas e Financeiro
- **Vendas**: novo filtro por **Mês** ou **Dia** (além de "Todos"), para conferir exatamente quais vendas entraram em cada data — essencial depois da importação de dados de meses anteriores.
- **Financeiro reorganizado em 3 rotas separadas**: **Custos fixos**, **Custos variáveis** e **Detalhamento de impostos** (antes fixos e variáveis ficavam juntos numa lista só).
- **Financeiro com filtro por mês**: os cards (custos fixos, variáveis, impostos devidos, lucro líquido) e as 3 rotas recalculam de acordo com o mês selecionado (ou "Todos" para a visão geral).
- O detalhamento de impostos passou a ser por **evento de recebimento** (cada venda, entrada ou parcela paga, com sua própria data) em vez de por contrato — isso é o que torna possível filtrar impostos por mês com precisão.

## v0.9 — Importação de dados históricos (Maio e Junho)
- Analisadas as planilhas complementares de Maio e Junho enviadas pelo utilizador.
- **Descoberta importante**: as recorrências dessas planilhas já estavam 100% representadas nos dados existentes (a aba "RECORRÊNCIA GERAL" de Julho já as carregava, com o estado mais atualizado de parcelas pagas) — nenhuma recorrência nova precisou de ser criada.
- Identificadas e importadas **45 vendas avulsas** (pagamento integral, sem recorrência associada) que ainda não estavam na base — comparadas registo a registo com as recorrências já existentes para não duplicar receita nem comissão.
- Importados **43 lançamentos de custos** (aluguer, salários, contabilista, etc.) de Maio e Junho, mantendo os já existentes de Julho intactos.
- A importação roda **uma única vez**, de forma automática e segura: verificada por uma marca em `meta.importMaioJunho2026`, nunca duplica mesmo que o painel seja recarregado várias vezes, e não apaga nem sobrescreve nenhuma edição já feita ao vivo no Supabase (parcelas marcadas como pagas, senhas de colaboradores, etc.).
- Corrigido manualmente 1 registo com data corrompida na planilha original (SONIA DIVINA, célula de data com erro de fórmula do Excel).

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
