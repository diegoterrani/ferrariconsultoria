-- Corrige lacuna encontrada pelo advisor de segurança do Supabase
-- (mcp__Supabase__get_advisors, lint rls_disabled_in_public) logo após
-- aplicar 0001: tenants e users são a raiz do modelo multi-tenant e
-- ficaram fora daquela migration — sem isso, o PostgREST expunha as duas
-- tabelas por completo a qualquer chamada autenticada, entre tenants.
-- Rodar get_advisors (ou o database linter do Supabase) depois de qualquer
-- DDL novo, não só depois da migration "principal" de RLS.

alter table tenants enable row level security;

create policy tenant_self_read on tenants
  for select
  using (
    id = current_setting('app.current_tenant_id', true)::uuid
    or current_setting('app.current_role', true) in ('admin', 'staff')
  );

-- Só admin/staff cria ou altera tenants (cadastro de cliente é ação da
-- consultoria, nunca do próprio cliente) — spec seção 3, perfis de acesso.
create policy tenant_write_admin_only on tenants
  for all
  using (current_setting('app.current_role', true) in ('admin', 'staff'))
  with check (current_setting('app.current_role', true) in ('admin', 'staff'));

alter table users enable row level security;

create policy users_tenant_scoped on users
  using (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    or current_setting('app.current_role', true) in ('admin', 'staff')
  );
