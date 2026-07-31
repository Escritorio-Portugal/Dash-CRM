# Changelog

## v2.0 — Segurança: Supabase Auth real + RLS por utilizador
- **Login real, verificado no servidor**: substituído o fluxo antigo (escolher "Sou gestor/Sou colaborador" + senha comparada no navegador — incluindo a senha do gestor, que estava em texto simples no próprio código) por login com e-mail/senha via Supabase Auth. Sem uma sessão válida, o Supabase agora recusa qualquer leitura ou escrita — a chave `anon`/`publishable` sozinha não dá mais acesso a nada.
- **RLS por utilizador**: nova tabela `profiles` liga cada conta de login a um papel (gestor/colaborador) e, se for colaborador, ao vendedor correspondente. Políticas novas: gestor tem acesso total; qualquer autenticado lê vendedores/catálogo/configurações gerais; **um colaborador só lê e escreve as suas próprias vendas, recorrências e funil diário** — nunca as de outro colaborador nem o financeiro (custos), que ficam exclusivos do gestor.
- **Separação de dados por vendedor**: `crm:sales`/`crm:recurrences` (um blob único, todos misturados) viraram `crm:sales:<sellerId>`/`crm:recurrences:<sellerId>`/`crm:funil:<sellerId>` — uma linha por vendedor, script de migração incluído (`supabase/migration_v2_auth_rls.sql`) para separar os dados já existentes sem perder nada.
- Removidos: o campo de senha do vendedor (cadastro, edição, listagem) e a senha do gestor embutida no código. Gestão de contas passa a ser feita no painel do Supabase (Authentication) — passo a passo completo em `docs/SECURITY_MIGRATION.md`.
- As migrações de correção de dados (histórico de importação, reconciliação, etc.) agora só rodam quando quem faz login é o gestor.
- Testada a lógica de carregamento/gravação por vendedor e o fluxo de login (sucesso, senha errada, perfil ausente) com um Supabase simulado antes da entrega — o comportamento real de RLS só pode ser confirmado depois de rodar a migração no projeto Supabase de verdade.

## v0.31 — Botão "Efetuar pagamento" nas recorrências atrasadas
- Na Visão Geral, a tabela de **Recorrências atrasadas** ganhou um botão **Efetuar pagamento** em cada linha — não precisa mais ir até Recorrências achar o cliente.
- Abre um modal com as parcelas ainda pendentes daquele contrato (pode marcar mais de uma de uma vez), pede a data do pagamento e confirma.
- Não existe "conexão" separada com o Financeiro: o botão marca a(s) parcela(s) como pagas no mesmo campo que já alimenta impostos, comissão e faturamento em todo o sistema — o lançamento aparece automaticamente em tudo assim que confirma (testado: marcar uma parcela de julho já muda na hora o total de impostos e a comissão daquele mês).

## v0.30 — Composição do pipeline por origem também estava incompleta
- Mesmo problema do gráfico de forma de pagamento, mas na aba **Clientes**: "Composição do pipeline por origem" excluía as vendas que também têm uma recorrência associada — mas "Valor Vendido" sempre conta essas vendas normalmente em todo o resto do sistema (a marcação de recorrência só existe pra não duplicar caixa/comissão, não afeta valor vendido). Corrigido: agora conta todas as vendas.
- Conferi todos os outros gráficos do sistema um por um: **"Faturamento por mês"** (Visão Geral) e **"Top vendedores"** já usavam os dados corretos desde as correções anteriores (vêm de `buildEvents`/`computeSellerStats`, que já tinham sido corrigidos). O **funil agregado** (Clientes) não tem relação com vendas/recorrências — é dado próprio do funil diário de cada vendedor, então não precisava de ajuste.

## v0.29 — Gráfico "Forma de pagamento" agora inclui recorrências
- **Bug corrigido**: o gráfico "Forma de pagamento mais utilizada" (Visão Geral) olhava só para `Vendas`, ignorando completamente o caixa das recorrências (entrada + parcelas pagas) — por isso os valores pareciam pequenos/desatualizados mesmo depois de todas as correções feitas em recorrências.
- Agora o gráfico soma vendas avulsas (sem duplicar as que já são o mesmo negócio de uma recorrência) **e** entrada + parcelas pagas de cada recorrência, usando a forma de pagamento gravada no contrato.
- Recorrências passam a ter campo próprio de **forma de pagamento** — preenchido automaticamente nas 51 de 53 já existentes (usando a venda correspondente como referência) e disponível pra editar a qualquer momento (botão Editar) ou definir ao criar uma nova recorrência.

## v0.28 — Correção em massa: valor de entrada das recorrências
- Aplicada a correção nas recorrências que tinham o "valor do contrato" gravado como o valor da entrada (não o honorário final real), com o campo de entrada zerado. Usei a venda correspondente (mesmo cliente + mesma data) como fonte da correção: 50 de 53 recorrências foram corrigidas (as outras 3 não tinham venda correspondente pra usar como referência).
- **Comissão sobre entradas que antes não contavam nada, recuperada por vendedor**: Fernanda €985,28 · Bernardo €235,77 · Karoline €229,01 · Larissa €144,31 · Luisa €30,49 — total geral **€1.624,85** somados de volta à comissão de todo mundo.
- No caminho, encontrei e corrigi outro problema: algumas vendas tinham o campo de taxa administrativa gravado como texto ("EM REGRA NÃO APLICÁVEL") em vez de número — isso quebraria o cálculo (viraria erro) assim que fosse copiado pra recorrência. Agora esses casos viram 0 automaticamente.

## v0.27 — Editar recorrência já cadastrada
- Novo botão **Editar** ao lado de "Excluir" em toda tabela de recorrências (Recorrências, Recorrências pagas, perfil do vendedor, Minhas Vendas). Abre um modal pra ajustar cliente, serviço, vendedor, data, valor do contrato, valor de entrada/já pago, honorário base, IVA, taxa administrativa e nº de parcelas.
- Ao mudar o nº de parcelas: aumentar adiciona parcelas pendentes no fim; reduzir remove as últimas (mantém o status pago/pendente das que continuam existindo).
- Isso também serve pra corrigir manualmente, caso a caso, o problema de `valorContrato`/`valorEntrada` sinalizado antes — sem precisar esperar por uma correção em massa.

## v0.26 — Correção da fórmula de comissão (IVA real do serviço, não % fixo) + catálogo alfabético
- **Bug corrigido**: a comissão descontava o IVA como 23% em cima do valor recebido (ex.: venda de €100 → líquido €77). Isso estava errado — o Catálogo de Serviços já grava, pra cada serviço, o valor de IVA que foi somado ao Honorário Base pra formar o Honorário Final (ex.: PRESENCIAL: base €81,30 + IVA €18,70 = €100). A comissão agora usa esse **valor de IVA real do serviço**, guardado em cada venda/recorrência, proporcional ao quanto foi efetivamente pago — não mais um percentual fixo sobre o recebido.
  - Exemplo conferido: Larissa, venda do Karanbir Singh (01/07, €100) — líquido agora €81,30 (10% = €8,13), não mais €77 (10% = €7,70).
  - A taxa administrativa continua exatamente como já era: só entra nas parcelas de recorrência, diluída pelo nº de parcelas.
  - O campo "Percentual de IVA a descontar" saiu de Configurações → Regras de comissão (não é mais usado em lugar nenhum do cálculo).
- **Catálogo de Serviços** (Configurações) agora aparece em **ordem alfabética** — assim como as listas de serviço usadas ao lançar uma venda ou recorrência.

## v0.25 — Subcards de vendas + detalhamento de comissão clicável
- Abaixo dos cards principais (Valor vendido/Faturado) — na Visão Geral, no perfil do vendedor (gestor) e em Minhas Vendas (colaborador) — aparecem agora 4 subcards: **vendas integrais** (pagas à vista, valor + quantidade), **vendas recorrentes** (valor contratado + nº de contratos), **parcelas pagas** e **parcelas em aberto** das recorrências do período.
- O valor da **comissão** (perfil do vendedor e Minhas Vendas) agora é clicável: abre um modal mostrando, linha a linha, todo recebimento que entrou na conta — data, cliente, tipo (venda/entrada/parcela), valor recebido, IVA descontado, taxa administrativa descontada, líquido e comissão — usando exatamente a mesma matemática do cálculo real, pra conferência.

## v0.24 — Financeiro: custos fixos repetem todo mês, variáveis zeram, tudo separado por mês
- **Financeiro agora abre por padrão no mês atual**, não mais no histórico total — antes o filtro "Total histórico" era o padrão, e por isso os impostos e custos de vários meses apareciam somados juntos.
- **Custos fixos passam a repetir automaticamente todo mês**, usando o valor mais recente lançado (aparecem marcados "repete"). Se o valor mudar num mês específico, basta lançar um novo custo fixo com esse nome naquele mês — ele passa a valer a partir dali, sem precisar editar os meses anteriores. Não é possível editar/excluir uma linha "repete" diretamente (ela não existe como registo próprio); lance um novo nome-mês pra sobrepor.
- **Custos variáveis continuam contando só no mês exato em que foram lançados** — já era assim, mas ficava escondido pela visão "histórico total" ser o padrão.
- **Removidas 23 duplicatas exatas de custos** (mesmo nome, categoria, vencimento e valor) que vinham de importações anteriores — estavam sendo somadas duas vezes sempre que a visão "histórico total" era usada.
- **Dois achados sinalizados, não corrigidos automaticamente** (envolvem valores de salário, então preferi não decidir sozinho):
  - **BERNARDO**: há duas entradas de maio com valores diferentes (€1.337,50 e €1.200,00) — depois da deduplicação, o sistema está projetando €1.337,50 pra frente (junho em diante), mas pode ser que o valor certo pra repetir seja €1.200,00. Precisa de confirmação.
  - **EVELIN**: só existe um lançamento (maio, €1.040,00), sem nenhum em junho — o sistema agora está repetindo esse valor pra frente indefinidamente. Se ela não trabalha mais no escritório desde maio, esse custo deve ser excluído/marcado como encerrado.

## v0.23 — Nova aba "Clientes" (análise de clientes e funil agregado)
- Nova aba própria na barra lateral do gestor, **Clientes**, com filtro de período (mês/semana/dia/histórico):
  - Cards: clientes novos no período, clientes recorrentes, conversas no funil (com taxa de conversão), total de clientes fiéis (histórico completo).
  - **Funil agregado de todos os vendedores**: soma o funil diário de cada um (conversas → respondeu → consulta marcada → consulta realizada → fechamentos), em barras — mesma estrutura da planilha.
  - **Composição do pipeline por origem**: de onde vieram as vendas do período (indicação, tráfego, site/google, instagram, etc.), por valor.
  - **Ranking de clientes**: quem mais fechou negócio com o escritório (histórico completo), valor total gerado, vendedor(es) responsável(is), 1ª e última compra, com selo "fiel" para quem tem 2+ fechamentos.
- "Fechamento" aqui conta vendas avulsas + recorrências, sem duplicar o mesmo contrato (vendas marcadas `jaContabilizadoViaRecorrencia` não entram de novo, já que a recorrência já representa aquele negócio).

## v0.22 — Resumo por vendedor em Vendas + barra lateral usando Valor Vendido
- **Vendas**: ao filtrar por vendedor (mês/período), aparece um resumo ao lado do filtro com 4 números: líquido de vendas avulsas, líquido de recorrência, líquido total (soma dos dois) e vendas no total (valor vendido/contratado).
- **Barra lateral (gestor)**: o valor ao lado de cada vendedor agora mostra o mesmo "Valor Vendido" do perfil individual dele — antes mostrava o faturamento em caixa (recebido), que é sempre menor quando há vendas parceladas ainda não totalmente pagas, e por isso não batia com o que aparece no perfil do vendedor. A ordenação da lista também passou a seguir esse valor.

## v0.21 — Reconciliação de Maio/Junho com as planilhas REGISTRO DE VENDAS reenviadas
- Comparei linha a linha as planilhas de Maio e Junho reenviadas contra o que já estava no sistema. Faltavam **31 vendas de maio** e **15 vendas de junho** — todas são o "Valor Vendido" de contratos que já existiam como recorrência (a entrada/parcela já estava sendo contada no caixa; só faltava o registo do valor total contratado). Entraram marcadas com `jaContabilizadoViaRecorrencia:true` para não duplicar caixa/comissão.
- Resultado: **Maio bate 28.948,55** e **Junho bate 21.905,38** — os mesmos valores de "VALOR ALCANÇADO" no DASH INICIAL de cada planilha.
- Corrigida a venda da **RAVENA GABRIELE DA SILVA**: estava datada de 15/05 mas só existe na aba REGISTRO DE VENDAS de **julho** — passou a contar para julho, fechando o Valor Vendido da Fernanda em €3.620,00 e o total de julho em €9.747,00 (Larissa €5.882 + Fernanda €3.620 + Bernardo €245).
- **Achado que não foi mexido, aguardando confirmação**: várias recorrências têm o campo `valorContrato` gravado com o valor da **entrada/pago-no-dia**, não o Honorário Final total do contrato (ex.: Cristóvão Fernão está com contrato de €100, mas a venda mestre mostra €350). Isso pode estar subestimando pendências, atraso e comissão por parcela em vários contratos — é uma correção maior e mais arriscada, então preferi sinalizar antes de mexer.

## v0.20 — "Funil Diário" separado de "Minhas Vendas"
- O funil manual diário deixou de ficar embutido dentro da tela "Minhas Vendas" do colaborador. Agora é uma subcategoria própria na navegação, logo abaixo: **Funil Diário**.
- Sem mudança de dados: os inputs continuam salvando em `seller.funilDiario`, só mudou onde a tabela aparece.

## v0.22 — Meta da Visão Geral agora usa "Valor Vendido" (mesma base da planilha)
- A meta do mês (número grande no topo + primeiro card) passou a comparar com **"Valor Vendido"** (total contratado, pago ou não) em vez do "Faturamento recebido" (caixa) — é exatamente a mesma base de cálculo que a "DASH INICIAL" da planilha original sempre usou pra calcular "Valor Alcançado".
- "Faturamento recebido (caixa)" continua disponível como card separado, só que não é mais o número comparado com a meta.
- **Explicação de uma diferença esperada**: depois de usarmos a aba individual da Larissa (mais completa) em vez da mestra, o nosso "Valor Vendido" de julho (€8.996,99) ficou **maior** que o "Valor Alcançado" da própria DASH INICIAL (€7.956,98) — isso é esperado e correto: a fórmula da planilha só enxerga a aba mestra de vendas, e não sabia das vendas extras registadas só na aba individual da Larissa.
- Confirmado e corrigido: a venda do Leandro Mariano Silva é mesmo uma venda integral avulsa (€350, sem recorrência associada) — já estava certa no sistema.

## v0.21 — Funil de vendas diário + correção da pendência fantasma do Leandro
- **Nova aba "Funil de vendas diário"**, substituindo o funil manual antigo (3 campos soltos): agora é uma tabela dia a dia do mês, igual à planilha original — Conversas iniciadas, Respondeu 1ª mensagem, Consulta marcada, Leads Qualificados, Vendas das consultas marcadas, Reagendado, No-Show, Consultas realizadas, Vendas Fora de Consulta, Valor da venda, Pago no dia. A data e o dia da semana de cada linha são gerados automaticamente conforme o mês em exibição.
- Aparece tanto no painel do colaborador (embaixo de "Minhas vendas") quanto no perfil completo que o gestor vê de cada vendedor.
- Os preenchimentos diários alimentam automaticamente as Conversas iniciadas, Leads Qualificados e a Taxa de conversão usadas no resto do painel — antes eram números soltos digitados manualmente.
- **Importante**: as colunas "Valor da venda" e "Pago no dia" aqui são só para acompanhamento do funil (no mesmo formato da planilha) — não entram na Faturamento/Comissão oficiais, que continuam vindo dos registos em Vendas/Recorrências, para não contar o mesmo dinheiro duas vezes.
- **Corrigida uma pendência fantasma**: a recorrência "Leandro Mariano Silva" (€350, criada na primeiríssima importação) não existe mais em nenhuma aba de recorrência da planilha atual — confirmei que ele aparece só no REGISTRO DE VENDAS e na aba individual da Larissa, os dois concordando: venda avulsa, paga integralmente. Era um registo desatualizado de uma versão antiga da planilha; removido.

## v0.20 — Listas limitadas a 5 itens + revalidação de Maio/Junho
- As listas longas da Visão Geral ("Atividade no período" e "Recorrências atrasadas") agora mostram só **5 itens por padrão**, com um botão "••• Ver mais" para expandir a lista completa (e "Ver menos" para recolher de novo).
- **Revalidação de Maio e Junho** com as planilhas atualizadas, seguindo o mesmo protocolo usado em julho (perfis individuais dos vendedores + "REGISTRO DE VENDAS" mestra, somando tudo): comparei cada linha, cliente a cliente, data a data, contra o que já está no sistema.
  - **Maio**: nenhum vendedor tinha a seção individual de "Registro de Vendas" preenchida ainda (só passou a ser usada a partir de junho) — a única fonte disponível é mesmo a planilha mestra, que já estava 100% importada.
  - **Junho**: a Larissa já tinha começado a preencher a seção individual, mas as 3 linhas encontradas são, na verdade, datadas de julho (não de junho) e já estavam no sistema.
  - **Resultado: nenhum dado novo para adicionar** — a base já estava correta e completa para os dois meses.

## v0.19 — Gestão de vendedores/pagamentos em Configurações, gráficos, alerta de atraso
- **Configurações → Vendedores**: nova aba para adicionar, ativar/desativar e abrir o perfil de qualquer vendedor direto dali, sem precisar ir pela barra lateral.
- **Configurações → Formas de pagamento**: nova aba para adicionar ou remover as formas de pagamento disponíveis — passam a ser usadas automaticamente no modal de lançamento rápido de venda.
- **Visão Geral → Gráficos**: novo painel com duas visualizações — forma de pagamento mais utilizada (filtrada pelo período selecionado: mês/semana/dia) e faturamento por mês (histórico completo, com o melhor mês destacado em dourado).
- **Visão Geral → Recorrências atrasadas**: novo quadro vermelho listando clientes com recorrência em atraso (mais de 30 dias sem quitar desde a venda — não há data de vencimento por parcela na planilha original, então esta é uma estimativa, não uma data contratual exata).
- **Alerta diário dispensável**: ao abrir o painel, se houver recorrências atrasadas, aparece um aviso vermelho no topo com a contagem. Tem um "×" para fechar; ao fechar, some pelo resto do dia e volta a aparecer automaticamente no dia seguinte (guardado localmente no navegador de quem fechou, não afeta outros utilizadores).

## v0.18 — Vendas individuais da Larissa substituem a fonte mestra
- Encontrada, dentro da própria aba individual de cada vendedor, uma segunda seção **"Registro de Vendas"** (mais completa que a aba mestra) e um bloco de comissão já calculado — ambos nunca antes processados.
- A aba individual da **Larissa** tinha 23 vendas de julho (contra ~9 que estavam na aba mestra), somando exatamente €5.882,00 — bate célula a célula com o "Valor total de vendas" e "Caixa Gerado" (€4.345,00) que já estavam calculados na própria aba dela.
- As vendas de julho da Larissa foram **substituídas inteiramente** pelas 23 da aba individual dela, por serem mais assertivas.
- Karoline e Bernardo não têm nada preenchido nessa seção individual em julho; a Fernanda não usa esse formato — para os três, a fonte continua sendo a aba mestra "REGISTRO DE VENDAS", por ser a única disponível.
- **Ponto em aberto identificado, não corrigido automaticamente**: a recorrência "LEANDRO MARIANO SILVA" (criada na primeiríssima importação) ainda aparece com uma parcela de €350 pendente, mas a aba individual da Larissa mostra esse mesmo cliente como pago integralmente. Precisa de confirmação de qual está certo antes de eu mexer.

## v0.17 — Reconciliação com a planilha atualizada de julho + métrica "Valor Vendido"
- **Descoberta da fórmula real do "Faturamento"** usada pela planilha original: soma da coluna "Honorário Final" do REGISTRO DE VENDAS por vendedor, independente de estar pago ou vinculado a uma recorrência — uma métrica de "vendas fechadas" (contratado), diferente da "Faturamento recebido" (caixa) que o painel já calculava.
- Nova métrica **"Valor Vendido"**, mostrada ao lado da "Faturamento recebido" no Ranking, no perfil de cada vendedor e na tela de Vendas — as duas convivem, com propósitos diferentes (vendido vs. recebido).
- Importadas 9 vendas de julho que estavam faltando (Matthew William Lund ×4, João Paulo Mello Gabry, Rogério Silva, Amanda Demetrio Souza, Eulénia Pires de Almeida, Alan Santos).
- Reintroduzidas 4 vendas (Edineia, Ravena, Gilklinton, Leandro) que haviam sido removidas por duplicidade com recorrências — elas voltam a contar no "Valor Vendido", mas ficam marcadas para não duplicar o caixa recebido.
- Trazidos os dados reais de funil da Larissa (101 conversas iniciadas, 13 leads qualificados em julho), extraídos da aba individual dela ("Controlhe Diário") que antes não era usada.
- **Números confirmados batendo com a planilha, célula a célula**: Larissa €4.091,99, Bernardo €244,998, Karoline €0 — a única diferença restante (Fernanda: €2.870 no painel vs. €3.620 na planilha) é uma venda de maio (Ravena) que a própria planilha soma por engano dentro do total de julho; o painel, corretamente, não conta.

## v0.16 — "Visão Geral" dentro do quadro da meta, filtros agrupados à esquerda
- O título **"Visão Geral"** saiu do topo separado e entrou dentro do próprio quadro dourado da meta, junto com o filtro de período.
- O quadro da meta agora ocupa **100% da largura** do topo (antes 80%).
- Título, abas Mês/Semana/Dia, setas de navegação, seletor de mês/dia e o botão "Hoje" ficam todos **agrupados à esquerda**, um do lado do outro — antes ficavam espalhados (um em cada ponta). O botão "Editar meta" continua isolado à direita.

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
