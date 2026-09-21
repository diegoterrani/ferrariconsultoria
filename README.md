# Plataforma Ferrari

Dashboard interno (RH Estratégico & DP Operacional) e portal de acompanhamento
para clientes da Ferrari Consultoria.

**Status atual: os três módulos de Prioridade 1 do MVP (B1, B6, C1) estão
implementados e autenticados — o PRD chama esse trio de "o único que de
fato alivia o gargalo de capacidade da fundadora".** A infraestrutura
(deploy, banco, isolamento multi-tenant, CI/CD) já estava validada; a
fase B1 implementou login (Auth.js, credenciais), wizard de 3 passos,
scoring determinístico, página de resultado com recomendação comercial
e o registro de decisão do cliente que alimenta o funil. A fase B6
implementou o layout autenticado com registro global de horas,
capacidade semanal configurável, a carteira de clientes (lista +
detalhe por abas), o painel de capacidade (gráfico de barras
empilhadas), o Kanban comercial (drag-and-drop nativo, sem dependência
nova) e a geração mensal de cobranças. A fase C1 implementou a geração
assistida de entregáveis por IA (Anthropic/Claude) com biblioteca de
templates, personalização a partir do assessment e a máquina de estados
de revisão humana obrigatória.

**O que ainda falta no MVP, honestamente:** o botão "Gerar relatório em
PDF" da página de resultado do B1 continua desabilitado (geração de PDF
não implementada); e `ANTHROPIC_API_KEY` precisa estar configurada no
Vercel (Production e Preview) para o C1 funcionar de fato em produção —
sem ela, a rota de geração responde 502 com um erro explícito, não falha
silenciosa.

Fonte da arquitetura e das decisões abaixo:
`.board/phases/f3_escopo_mvp/especificacao_plataforma_dev.md` (spec técnica
v2.0) e `prd_plataforma.md` (escopo funcional), no repositório do conselho
consultivo do projeto.

## Stack

TypeScript ponta a ponta · Next.js 16 (App Router, Turbopack) · Prisma
(`engineType = "client"`, driver adapters — sem binário nativo, alinhado ao
runtime serverless do Vercel) · PostgreSQL via Supabase (Row-Level Security
para isolamento multi-tenant) · Auth.js (credenciais + magic link) ·
`@anthropic-ai/sdk` (módulo C1, atrás de `src/lib/ai-provider.ts`) · Vitest +
Playwright · GitHub Actions.

Racional de cada escolha: seção 2 da especificação técnica.

**Desvio deliberado da seção 2 (documentado em `api/deliverables/route.ts`):**
a spec recomenda uma fila de jobs assíncronos (Inngest ou BullMQ+Redis) para
a geração de entregáveis por IA não bloquear a tela. Esta versão chama a IA
de forma síncrona dentro da própria requisição HTTP — a UX exigida
("estado de carregamento visível, nunca um spinner mudo") é alcançada com
um `fetch` aguardado e um botão desabilitado, a geração fica dentro do
limite de função serverless do Vercel, e a escala do MVP (1-3 clientes) não
paga o custo operacional de mais um serviço (Redis) a manter — coerente com
a restrição da seção 1 ("o que uma ou duas pessoas conseguem operar
sozinhas"). Se o volume crescer a ponto do tempo de resposta virar
problema, essa é a linha a trocar por um job assíncrono, não o produto
inteiro.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL com um Postgres real
npx prisma generate
npm run dev
```

Para o módulo C1 (geração de entregáveis por IA) funcionar, `ANTHROPIC_API_KEY`
precisa estar preenchida em `.env.local` (dev) e configurada como variável de
ambiente no Vercel — Production e Preview — antes do primeiro uso em
produção; sem ela, `POST /api/deliverables` responde 502 com um erro
explícito (`src/lib/ai-provider.ts`), nunca falha silenciosa ou gera
conteúdo vazio.

`npx prisma generate` baixa o engine da Prisma de `binaries.prisma.sh`; se a
rede estiver atrás de um proxy restritivo, isso falha — não falha no CI do
GitHub Actions nem no build do Vercel, que têm rede aberta.

**Limitação conhecida do ambiente de desenvolvimento em sandbox (ex.: este
container Claude Code): `npx tsc --noEmit` e `next build` não são
confiáveis para validar código que toca modelos Prisma.** Sem rede para
`binaries.prisma.sh`, `prisma generate` nunca roda de verdade — o que fica
em `node_modules/.prisma/client` é um stub degenerado (poucos KB, sem os
tipos gerados), e todo campo de model aparece como
`Property 'X' does not exist on type '{}'` no typecheck, mesmo em código
correto. Confirmado root-caused inspecionando o stub e testando o flag
oficial `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` (documentado pelo
próprio Prisma para ambientes offline) — não resolve, porque o problema é
o download do engine em si, não a checksum. **Não é um bug de código**: o
Vercel roda `prisma generate` de verdade no `postinstall` (rede aberta),
então o build real — e portanto o typecheck real — acontece lá. Nesse tipo
de ambiente, trate um erro `does not exist on type '{}'` sobre um campo que
existe em `prisma/schema.prisma` como este limite, não como uma regressão;
qualquer outro tipo de erro do `tsc` continua sendo um bug de verdade e
precisa ser corrigido antes do deploy.

## Segurança multi-tenant — leia antes de escrever uma query

Nenhuma rota deve chamar `prisma.<model>.findMany()` (ou qualquer método)
diretamente. Toda leitura/escrita passa por `withTenantContext` (`src/lib/db.ts`),
que seta `app.current_tenant_id`/`app.current_role` na sessão de banco antes
da query — é o que ativa as policies RLS de `supabase/migrations/000*.sql`.
Uma query fora desse caminho não vaza dado (a RLS barra mesmo sem o contexto
setado, ver comentário no arquivo), mas também não retorna nada — ou seja,
"esquecer" o wrapper quebra a feature, não a segurança. Isso é deliberado.

**Toda migration nova precisa passar pelo advisor de segurança do Supabase**
antes de ser considerada pronta (`mcp__Supabase__get_advisors`, tipo
`security`, ou o Database Linter no dashboard). A migration 0001 original
cobria só as tabelas filhas (assessments, deliverables, etc.) e o advisor
pegou `tenants`/`users` sem RLS nenhuma, expostas por completo via
PostgREST — corrigido em 0002. Não confie só na leitura manual do SQL para
confirmar cobertura de RLS.

## O que existe hoje

- `prisma/schema.prisma` — as entidades-base da seção 5 da spec, os
  campos do fluxo B1 (`User.passwordHash`, `Assessment.updatedAt`,
  `PipelineLead.decisao`/`motivoDecisao`/`pacoteSugerido`/`assessmentId`),
  o modelo `CapacitySettings` do B6 (singleton — linha única
  `id = 'default'`, reforçado por `CHECK` no banco) e os campos do C1 em
  `Deliverable` (`titulo`, `templateBaseId`, `assessmentId`,
  `tempoManualEstimadoMinutos`).
- `supabase/migrations/0001_multi_tenant_rls.sql` +
  `0002_rls_root_tables.sql` + `0003_b1_assessment_flow.sql` +
  `0004_b6_carteira.sql` + `0005_c1_entregaveis.sql` — isolamento por
  tenant (RLS) e o schema dos três módulos de Prioridade 1; todas
  passaram pelo advisor de segurança do Supabase sem achados novos. A
  0004 também corrigiu um gap de RLS pré-existente: as policies de 0001
  só liberavam o bypass de tenant para `role = 'admin'`, nunca para
  `'staff'`, apesar da spec (seção 3) e do schema dizerem que staff tem
  "mesmo escopo de dados da administradora" — staff autentica desde o
  B1, então isso silenciosamente zerava os resultados de qualquer rota
  para um usuário staff (RLS fail-safe, não vazamento, mas feature
  quebrada). Corrigido incluindo `'staff'` no bypass de todas as tabelas
  afetadas.
- **Autenticação (Auth.js v5, credenciais)** — `src/lib/auth.ts`,
  `src/proxy.ts` (não `middleware.ts` — renomeado no Next 16, ver comentário
  no arquivo), `src/app/login/`. Só admin/staff autenticam nesta fatia; o
  papel e o tenant vêm exclusivamente da consulta ao banco no `authorize`,
  nunca de um campo do formulário.
- **Módulo B1 completo (wizard → score → resultado → decisão)**:
  `src/app/(app)/assessments/novo` (wizard de 3 passos, autosave por
  passo, máscara de CNPJ), `src/lib/scoring/exposicao-trabalhista.ts`
  (motor de score, função pura e testada, sem IA — spec seção 6.1),
  `src/lib/apresentacao/nivel-atencao.ts` (tradução score → texto,
  deliberadamente fora do motor de score, linguagem não-alarmista da seção
  8.4), `src/app/(app)/assessments/[id]/resultado` (gauge, benchmark
  estático, modal de decisão do cliente), rotas de API em
  `src/app/api/assessments/**` e `src/app/api/pipeline-leads`.
- **Módulo B6 completo (carteira, capacidade, pipeline, faturamento)**:
  layout autenticado compartilhado `src/app/(app)/layout.tsx` (Next 16
  route group — agrupa `/`, `/assessments/**` e `/carteira/**` sob um
  header comum sem afetar a URL) com o botão global "+ Registrar horas"
  (`registrar-horas-button.tsx`); `/carteira` (lista de clientes com
  horas do mês vs. horas contratadas, barra de progresso com limiares da
  spec); `/carteira/[id]` (detalhe por abas — dados, horas, faturamento,
  entregáveis; a aba de entregáveis lista os entregáveis já gerados e dá
  acesso ao "Gerar entregável" do C1); `/carteira/capacidade` (gráfico de barras
  empilhadas em SVG puro, sem biblioteca de gráficos, com linha
  tracejada de referência para a capacidade semanal configurável, que
  fica em `capacity_settings` — nunca hardcoded, spec seção 6.2);
  `/carteira/pipeline` (Kanban com 4 colunas, drag-and-drop nativo do
  HTML5 — sem biblioteca de DnD — com reversão otimista em caso de
  falha); `/carteira/faturamento` (geração idempotente de cobranças do
  mês — não duplica cobrança se o botão for clicado duas vezes — e
  marcação manual de status). `src/lib/carteira/pacotes.ts` centraliza a
  tabela de preços/horas da seção 11 da spec (única fonte de verdade,
  reaproveitando os nomes "Básico"/"Premium"/"Implantação" já usados no
  B1). A ponte B1→B6 que faltava (`tenants.pacoteContratado` nunca era
  escrito por nenhum código) foi fechada: o único evento que torna um
  tenant um cliente de carteira de fato é o branch de "aceite" da rota
  `POST /api/pipeline-leads` (decisão do cliente no B1); há também um
  caminho de correção manual via `PATCH /api/tenants/[id]`.
- **Módulo C1 completo (geração de entregáveis por IA)**: `src/lib/ai-provider.ts`
  (camada de abstração da spec seção 2 — implementação real com
  `@anthropic-ai/sdk`, model `claude-sonnet-5` configurável via
  `ANTHROPIC_MODEL`; nunca aprova automaticamente, spec 8.3); `src/lib/entregaveis/templates.ts`
  (biblioteca de templates da spec C1.1 — 9 templates entre descrição de
  cargo, política interna e material de onboarding, gastronomia/hotelaria);
  `gerar-entregavel-modal.tsx` (ponto de entrada compartilhado, usado em
  `/carteira/[id]` e `/assessments/[id]/resultado`); `/entregaveis/[id]`
  (editor — textarea de markdown em vez de WYSIWYG, mesmo racional de
  "sem dependência nova sem necessidade real" do B6; barra de status fixa;
  botão "Enviar ao cliente" desabilitado com tooltip até `aprovado`, spec
  8.3); rota `POST /api/deliverables` (chama a IA de forma síncrona — ver
  desvio de arquitetura documentado na seção Stack acima — e não grava
  nada no banco se a geração falhar, sem rascunho órfão) e `PATCH /api/deliverables/[id]`
  (máquina de estados `rascunho→em_revisao→aprovado→enviado`, tabela de
  transições explícita, rejeita qualquer pulo de estado mesmo via chamada
  direta à API). "Enviado" nesta versão é só o registro do estágio — envio
  automático de fato depende do portal do cliente (módulo A1, fora do
  MVP), mesmo princípio de honestidade de escopo do faturamento do B6.
- `src/app/api/health` — health-check de deploy; reporta `service` (build no
  ar) e `database` (`SELECT 1` via `DATABASE_URL`) separadamente, fora de
  `withTenantContext` — não lê dado de tenant, só confirma que o Postgres do
  Supabase está alcançável a partir do runtime do Vercel.
- `src/lib/db.ts` instancia o Prisma Client com `@prisma/adapter-pg`
  (`engineType = "client"` exige um driver adapter explícito) e expõe
  `withTenantContext` — caminho único para qualquer query de aplicação, ver
  "Segurança multi-tenant" acima.
- **Testes**: `src/lib/cnpj.test.ts` e
  `src/lib/scoring/exposicao-trabalhista.test.ts` (unitários, algoritmo/
  regras de negócio puras), `src/lib/carteira/pacotes.test.ts`,
  `src/lib/carteira/periodo.test.ts` e `src/lib/carteira/semanas.test.ts`
  (unitários — tabela de preços, limites de mês em UTC incluindo virada
  de ano, bucketing de semana ISO com segunda-feira como início,
  incluindo o caso de domingo voltar pra segunda anterior, não a
  seguinte), `tests/integration/assessments-api.test.ts` (as 4 rotas de
  API do B1), `tests/integration/carteira-api.test.ts` (as 8 rotas de
  API do B6 — registro de horas, edição de tenant, capacidade,
  movimentação de card no pipeline, a ponte aceite→pacoteContratado
  testada nos dois sentidos, preview e geração idempotente de cobranças,
  status manual) e `tests/integration/deliverable-state-machine.test.ts`
  (as rotas de API do C1 — `@/lib/ai-provider` também mockado, nenhuma
  chamada de rede real em teste; cobre as 3 transições sequenciais
  válidas, cada pulo de estado possível rejeitado com 409, edição de
  conteúdo permitida só antes de aprovado, e que nenhum `Deliverable` é
  gravado quando a IA falha). Todos os arquivos de integração seguem o mesmo padrão: 401/403
  sempre antes de tocar o banco, corpo inválido rejeitado, e o contexto
  de tenant passado pra `withTenantContext` vem sempre da sessão, nunca
  do corpo da requisição, mesmo quando o corpo tenta injetar campos como
  `tenantId`/`estagio`/`decisao`/`status` — mockando `@/lib/auth` e
  `@/lib/db`, não precisa de banco real. Dos 4 testes obrigatórios da
  seção 9 da spec: #3 (scoring determinístico) está coberto pelo teste
  unitário do motor de score; #2 (máquina de estados de deliverable) está
  coberto por `deliverable-state-machine.test.ts`; #1 (isolamento RLS,
  precisa de banco real) e #4 (E2E do Playwright, precisa do PDF do B1)
  continuam pendentes — ver comentário em cada arquivo, status honesto.

## O que NÃO existe ainda (não é bug, é escopo)

Geração de PDF do resultado do B1 (botão desabilitado na tela, spec seção
6.1), portal do cliente (módulo A1-A3), Supabase Storage, e os módulos de
Prioridade 2/3 do PRD (C2 — LGPD/operador de dados; B2-B5 — recrutamento,
admissão, folha, gestão de desempenho). Ver seção 6 da spec técnica para
o desenho de cada tela antes de implementar.

## Vulnerabilidade conhecida (dependência de desenvolvimento)

`npm audit` reporta 3 "high" em `deepmerge-ts` via `@prisma/config` →
`prisma` (CLI). É uma dependência só de desenvolvimento (não entra no
bundle de produção — `@prisma/client`, que roda em produção, não depende
dela) e o problema é um DoS por stack exhaustion ao mesclar objetos de
config profundamente recursivos — não há vetor de exploração pela aplicação
implantada. É um problema upstream do Prisma (toda a linha 6.13+ é afetada
até a correção subir); reavaliar quando uma versão corrigida for publicada,
não fazer downgrade do Prisma para "resolver".
