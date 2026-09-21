# Plataforma Ferrari

Dashboard interno (RH Estratégico & DP Operacional) e portal de acompanhamento
para clientes da Ferrari Consultoria.

**Status atual: módulo B1 (Assessment/Diagnóstico) implementado e
autenticado; B6 (Gestão de carteira) e C1 (IA generativa de entregáveis)
ainda não.** A infraestrutura (deploy, banco, isolamento multi-tenant,
CI/CD) já estava validada; esta fase implementou o primeiro dos três
módulos de Prioridade 1 do MVP: login (Auth.js, credenciais), wizard de 3
passos, scoring determinístico, página de resultado com recomendação
comercial e o registro de decisão do cliente que alimenta o funil (B6
ainda não tem tela própria — o registro só grava a linha).

Fonte da arquitetura e das decisões abaixo:
`.board/phases/f3_escopo_mvp/especificacao_plataforma_dev.md` (spec técnica
v2.0) e `prd_plataforma.md` (escopo funcional), no repositório do conselho
consultivo do projeto.

## Stack

TypeScript ponta a ponta · Next.js 16 (App Router, Turbopack) · Prisma
(`engineType = "client"`, driver adapters — sem binário nativo, alinhado ao
runtime serverless do Vercel) · PostgreSQL via Supabase (Row-Level Security
para isolamento multi-tenant) · Auth.js (credenciais + magic link) · Vitest +
Playwright · GitHub Actions.

Racional de cada escolha: seção 2 da especificação técnica.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL com um Postgres real
npx prisma generate
npm run dev
```

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

- `prisma/schema.prisma` — as entidades-base da seção 5 da spec, mais os
  campos do fluxo B1 adicionados nesta fase (`User.passwordHash`,
  `Assessment.updatedAt`, `PipelineLead.decisao`/`motivoDecisao`/
  `pacoteSugerido`/`assessmentId`).
- `supabase/migrations/0001_multi_tenant_rls.sql` +
  `0002_rls_root_tables.sql` + `0003_b1_assessment_flow.sql` — isolamento
  por tenant (RLS) e o schema do fluxo B1; todas passaram pelo advisor de
  segurança do Supabase sem achados novos.
- **Autenticação (Auth.js v5, credenciais)** — `src/lib/auth.ts`,
  `src/proxy.ts` (não `middleware.ts` — renomeado no Next 16, ver comentário
  no arquivo), `src/app/login/`. Só admin/staff autenticam nesta fatia; o
  papel e o tenant vêm exclusivamente da consulta ao banco no `authorize`,
  nunca de um campo do formulário.
- **Módulo B1 completo (wizard → score → resultado → decisão)**:
  `src/app/assessments/novo` (wizard de 3 passos, autosave por passo,
  máscara de CNPJ), `src/lib/scoring/exposicao-trabalhista.ts` (motor de
  score, função pura e testada, sem IA — spec seção 6.1),
  `src/lib/apresentacao/nivel-atencao.ts` (tradução score → texto,
  deliberadamente fora do motor de score, linguagem não-alarmista da seção
  8.4), `src/app/assessments/[id]/resultado` (gauge, benchmark estático,
  modal de decisão do cliente), rotas de API em
  `src/app/api/assessments/**` e `src/app/api/pipeline-leads`.
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
  regras de negócio puras) e `tests/integration/assessments-api.test.ts`
  (as 4 rotas de API do B1 — 401/403 sempre antes de tocar o banco, corpo
  inválido rejeitado, e o contexto de tenant passado pra
  `withTenantContext` vem sempre da sessão, nunca do corpo da requisição,
  mesmo quando o corpo tenta injetar um `tenantId`/`estagio` — mockando
  `@/lib/auth` e `@/lib/db`, não precisa de banco real). Dos 4 testes
  obrigatórios da seção 9 da spec: #3 (scoring determinístico) está coberto
  pelo teste unitário do motor de score; #1 (isolamento RLS) e #2 (máquina
  de estados de deliverable, módulo C1) continuam `skip`/`todo` até
  `DATABASE_URL_TEST` existir / o módulo C1 ser implementado — ver
  comentário em cada arquivo, status honesto.

## O que NÃO existe ainda (não é bug, é escopo)

Módulos B6 (Kanban/carteira — hoje só a linha em `pipeline_leads` é
gravada, sem tela) e C1 (IA generativa de entregáveis, geração de PDF do
resultado do B1), portal do cliente, Supabase Storage. Ver seção 6 da spec
técnica para o desenho de cada tela antes de implementar.

## Vulnerabilidade conhecida (dependência de desenvolvimento)

`npm audit` reporta 3 "high" em `deepmerge-ts` via `@prisma/config` →
`prisma` (CLI). É uma dependência só de desenvolvimento (não entra no
bundle de produção — `@prisma/client`, que roda em produção, não depende
dela) e o problema é um DoS por stack exhaustion ao mesclar objetos de
config profundamente recursivos — não há vetor de exploração pela aplicação
implantada. É um problema upstream do Prisma (toda a linha 6.13+ é afetada
até a correção subir); reavaliar quando uma versão corrigida for publicada,
não fazer downgrade do Prisma para "resolver".
