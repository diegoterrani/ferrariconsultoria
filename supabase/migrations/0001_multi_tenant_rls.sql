-- Isolamento multi-tenant via Row-Level Security.
--
-- Fonte: especificacao_plataforma_dev.md, seção 4 — "regra não negociável:
-- nenhuma query ao banco pode depender só da lógica da aplicação para
-- filtrar por tenant". Esta migration é a rede de segurança redundante no
-- próprio Postgres: mesmo que uma query nova esqueça o WHERE tenant_id,
-- o banco recusa a linha.
--
-- app.current_tenant_id e app.current_role são setados pela aplicação a
-- cada request, a partir do JWT da sessão autenticada (ver src/lib/db.ts) —
-- nunca a partir de um parâmetro vindo do cliente (query string, body).
-- Teste obrigatório #1 (spec seção 9) cobre exatamente esta garantia.

do $$
declare
  t text;
begin
  foreach t in array array[
    'assessments', 'deliverables', 'time_entries',
    'pipeline_leads', 'invoices', 'data_subjects'
  ]
  loop
    execute format('alter table %I enable row level security', t);

    execute format(
      'create policy tenant_isolation on %I
         using (
           tenant_id = current_setting(''app.current_tenant_id'', true)::uuid
           or current_setting(''app.current_role'', true) = ''admin''
         )',
      t
    );
  end loop;
end $$;

-- sensitive_records não tem tenant_id direto (é filho de data_subjects) —
-- policy própria, mais restrita, via join (spec seção 8.1: acesso mais
-- restrito que o resto do RH, nunca a mesma regra das outras tabelas).
alter table sensitive_records enable row level security;

create policy sensitive_record_isolation on sensitive_records
  using (
    exists (
      select 1 from data_subjects ds
      where ds.id = sensitive_records.data_subject_id
        and (
          ds.tenant_id = current_setting('app.current_tenant_id', true)::uuid
          or current_setting('app.current_role', true) = 'admin'
        )
    )
  );

-- audit_log: qualquer usuário autenticado pode INSERIR seu próprio registro
-- (a aplicação grava a cada leitura de dado sensível), ninguém edita ou
-- apaga — é log de auditoria, não estado de aplicação.
alter table audit_log enable row level security;

create policy audit_log_insert_only on audit_log
  for insert
  with check (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    or current_setting('app.current_role', true) = 'admin'
  );

create policy audit_log_read on audit_log
  for select
  using (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    or current_setting('app.current_role', true) = 'admin'
  );

-- Consentimento antes do dado (spec seção 8.5): a coluna existe desde já
-- para o app poder bloquear o salvamento dos demais campos até o registro
-- existir; a constraint NOT NULL definitiva entra quando o módulo A3.2
-- (cadastro de colaborador) for implementado, para não travar seeds/dev
-- antes disso.
comment on column data_subjects.consentimento_registrado_em is
  'Bloqueante para gravação dos demais campos via camada de aplicação (spec 8.5) — módulo A3.2, Fase 3.';
