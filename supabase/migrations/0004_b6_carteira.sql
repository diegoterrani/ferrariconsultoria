-- Suporte ao módulo B6 (Gestão de carteira — spec seção 6.2): configuração
-- de capacidade e correção de uma lacuna de RLS encontrada ao revisar as
-- policies existentes antes de adicionar novas tabelas.

-- DIAGNÓSTICO (não é mudança de escopo do B6, é bug pré-existente): as
-- policies de 0001_multi_tenant_rls.sql (assessments, deliverables,
-- time_entries, pipeline_leads, invoices, data_subjects, sensitive_records,
-- audit_log) só liberam bypass de tenant para
-- current_setting('app.current_role') = 'admin'. A spec (seção 3) e os
-- comentários do próprio schema.prisma são explícitos: "staff" (colaborador
-- da consultoria) tem "mesmo escopo de dados da administradora" — e é role
-- que já autentica desde o B1 (users.role inclui staff, src/lib/auth.ts não
-- distingue admin/staff em nenhum authorize()). 0002_rls_root_tables.sql
-- (tenants, users) já tinha corrigido isso incluindo staff; esta migration
-- estende a mesma correção às tabelas de 0001 — sem isso, um usuário staff
-- autenticado passaria pelo `if (role !== "admin" && role !== "staff")` da
-- API e então bateria numa RLS que devolve conjunto vazio (falha segura,
-- não vazamento — mas quebra a feature pra staff, silenciosamente).
do $$
declare
  t text;
begin
  foreach t in array array[
    'assessments', 'deliverables', 'time_entries',
    'pipeline_leads', 'invoices', 'data_subjects'
  ]
  loop
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format(
      'create policy tenant_isolation on %I
         using (
           tenant_id = current_setting(''app.current_tenant_id'', true)::uuid
           or current_setting(''app.current_role'', true) in (''admin'', ''staff'')
         )',
      t
    );
  end loop;
end $$;

drop policy if exists sensitive_record_isolation on sensitive_records;
create policy sensitive_record_isolation on sensitive_records
  using (
    exists (
      select 1 from data_subjects ds
      where ds.id = sensitive_records.data_subject_id
        and (
          ds.tenant_id = current_setting('app.current_tenant_id', true)::uuid
          or current_setting('app.current_role', true) in ('admin', 'staff')
        )
    )
  );

drop policy if exists audit_log_insert_only on audit_log;
create policy audit_log_insert_only on audit_log
  for insert
  with check (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    or current_setting('app.current_role', true) in ('admin', 'staff')
  );

drop policy if exists audit_log_read on audit_log;
create policy audit_log_read on audit_log
  for select
  using (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    or current_setting('app.current_role', true) in ('admin', 'staff')
  );

-- Capacidade semanal — painel /carteira/capacidade (spec seção 6.2: "hoje
-- 10h/semana, valor configurável quando a fundadora migrar para dedicação
-- full-time — não deve ser hardcoded"). Singleton: id fixo 'default' via
-- check constraint, nunca uma segunda linha. Sem tenant_id — não é dado de
-- cliente, é configuração interna da consultoria.
create table capacity_settings (
  id text primary key default 'default' check (id = 'default'),
  horas_por_semana integer not null default 10,
  updated_at timestamptz not null default now()
);

insert into capacity_settings (id, horas_por_semana) values ('default', 10);

alter table capacity_settings enable row level security;

create policy capacity_settings_admin_staff on capacity_settings
  for all
  using (current_setting('app.current_role', true) in ('admin', 'staff'))
  with check (current_setting('app.current_role', true) in ('admin', 'staff'));
