-- Espelha prisma/schema.prisma. Aplicado via SQL direto (não via
-- `prisma migrate`) porque o ambiente de desenvolvimento usado para montar
-- este esqueleto não alcançava binaries.prisma.sh — ver README.md, seção
-- "Rodando localmente". Quando o time de dev rodar `prisma migrate dev`
-- pela primeira vez num ambiente com rede normal, reconciliar o histórico
-- com `prisma migrate resolve --applied 0000_init_schema` em vez de deixar
-- a Prisma tentar recriar estas tabelas.

create extension if not exists "pgcrypto";

create type "Role" as enum ('admin', 'staff', 'client_owner');
create type "TenantStatus" as enum ('ativo', 'risco_churn', 'encerrado');
create type "DeliverableStatus" as enum ('rascunho', 'em_revisao', 'aprovado', 'enviado');
create type "ActivityType" as enum ('entrega', 'prospeccao', 'administrativo');
create type "PipelineStage" as enum ('contato', 'reuniao', 'diagnostico', 'fechamento');
create type "InvoiceStatus" as enum ('pendente', 'pago', 'atrasado');
create type "SensitiveRecordType" as enum ('saude_ocupacional', 'bancario');

create table tenants (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  cnpj text not null unique,
  porte text not null,
  segmento text not null,
  pacote_contratado text,
  status "TenantStatus" not null default 'ativo',
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role "Role" not null,
  tenant_id uuid references tenants(id),
  created_at timestamptz not null default now()
);
create index users_tenant_id_idx on users(tenant_id);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  respostas jsonb not null,
  score_exposicao integer,
  status text not null default 'rascunho',
  created_at timestamptz not null default now()
);
create index assessments_tenant_id_idx on assessments(tenant_id);

create table deliverables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  tipo text not null,
  conteudo text not null,
  status "DeliverableStatus" not null default 'rascunho',
  gerado_por_ia boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deliverables_tenant_id_idx on deliverables(tenant_id);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  atividade "ActivityType" not null,
  duracao_minutos integer not null,
  data timestamptz not null
);
create index time_entries_tenant_id_idx on time_entries(tenant_id);

create table pipeline_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  estagio "PipelineStage" not null default 'contato'
);
create index pipeline_leads_tenant_id_idx on pipeline_leads(tenant_id);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  competencia text not null,
  valor numeric(10,2) not null,
  status "InvoiceStatus" not null default 'pendente'
);
create index invoices_tenant_id_idx on invoices(tenant_id);

create table data_subjects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  nome text not null,
  cpf_criptografado text not null,
  consentimento_registrado_em timestamptz
);
create index data_subjects_tenant_id_idx on data_subjects(tenant_id);

create table sensitive_records (
  id uuid primary key default gen_random_uuid(),
  data_subject_id uuid not null references data_subjects(id),
  tipo "SensitiveRecordType" not null,
  conteudo_criptografado text not null,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  tenant_id uuid not null references tenants(id),
  acao text not null,
  entidade text not null,
  entidade_id text not null,
  "timestamp" timestamptz not null default now()
);
create index audit_log_tenant_id_idx on audit_log(tenant_id);
