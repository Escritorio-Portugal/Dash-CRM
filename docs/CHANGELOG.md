# Changelog

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
