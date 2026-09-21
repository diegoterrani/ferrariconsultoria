-- Suporte ao módulo B1 (wizard de diagnóstico) — espelha as mudanças de
-- prisma/schema.prisma para este slice: login de admin/staff, autosave do
-- assessment, e o modal "Registrar decisão do cliente" (spec seção 6.1).
-- Aplicado via SQL direto pelo mesmo motivo de 0000_init_schema.sql: este
-- ambiente de dev não alcança binaries.prisma.sh, então `prisma migrate`
-- não roda aqui (funciona no CI/Vercel — ver README).

-- users.password_hash: só admin/staff autenticam no MVP (client_owner é
-- portal futuro, fora desta fatia). Tabela está vazia agora (nenhum usuário
-- criado ainda), então NOT NULL direto não exige backfill.
alter table users add column password_hash text not null;

alter table assessments add column updated_at timestamptz not null default now();

create type "DecisaoCliente" as enum ('aceite', 'recusa', 'nao_agora');

alter table pipeline_leads
  add column assessment_id uuid references assessments(id),
  add column decisao "DecisaoCliente",
  add column motivo_decisao text,
  add column pacote_sugerido text,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

create index pipeline_leads_assessment_id_idx on pipeline_leads(assessment_id);
