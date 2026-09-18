# Plataforma Ferrari

Dashboard interno (RH Estratégico & DP Operacional) e portal de acompanhamento
para clientes da Ferrari Consultoria.

**Status atual: esqueleto de infraestrutura, sem módulos de produto.** Este
repositório valida a arquitetura decidida na especificação técnica — deploy,
banco, isolamento multi-tenant, CI/CD — antes da implementação de B1
(Assessment/Diagnóstico), B6 (Gestão de carteira) e C1 (IA generativa de
entregáveis), os três módulos de Prioridade 1 do MVP.

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

`npm run build` funciona com um `DATABASE_URL` placeholder — nenhuma rota
hoje consulta o banco (ver "O que existe hoje"). `npx prisma generate` baixa
o engine da Prisma de `binaries.prisma.sh`; se a rede estiver atrás de um
proxy restritivo, isso falha — não falha no CI do GitHub Actions nem no build
do Vercel, que têm rede aberta.

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

- `prisma/schema.prisma` — as 10 entidades-base da seção 5 da spec.
- `supabase/migrations/0001_multi_tenant_rls.sql` — isolamento por tenant, RLS.
- `src/lib/scoring/exposicao-trabalhista.ts` — motor de score do módulo B1
  (função pura, testada, sem chamada a IA — spec seção 6.1).
- `src/lib/ai-provider.ts` — contrato da camada de abstração de IA (módulo
  C1); implementação real fica para quando esse módulo entrar em desenvolvimento.
- `src/app/api/health` — health-check de deploy.
- 4 testes obrigatórios da seção 9 da spec, com status honesto: os que
  dependem de banco/API real (#1, #2, #4) ficam `skip`/`fixme` até essa
  infraestrutura existir — ver comentário em cada arquivo de teste.

## O que NÃO existe ainda (não é bug, é escopo)

Nenhuma tela de produto (wizard de diagnóstico, carteira, pipeline,
faturamento, editor de entregável), autenticação real, Supabase Storage,
integração com a API da Anthropic. Ver seção 6 da spec técnica para o
desenho de cada tela antes de implementar.

## Vulnerabilidade conhecida (dependência de desenvolvimento)

`npm audit` reporta 3 "high" em `deepmerge-ts` via `@prisma/config` →
`prisma` (CLI). É uma dependência só de desenvolvimento (não entra no
bundle de produção — `@prisma/client`, que roda em produção, não depende
dela) e o problema é um DoS por stack exhaustion ao mesclar objetos de
config profundamente recursivos — não há vetor de exploração pela aplicação
implantada. É um problema upstream do Prisma (toda a linha 6.13+ é afetada
até a correção subir); reavaliar quando uma versão corrigida for publicada,
não fazer downgrade do Prisma para "resolver".
