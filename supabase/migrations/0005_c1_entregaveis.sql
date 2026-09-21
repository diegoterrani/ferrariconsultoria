-- Módulo C1 (IA generativa de entregáveis) — spec seção 6.3 / 5, PRD C1.1-C1.3.
--
-- `deliverables` já existia (criada em 0001, nunca populada — a tabela
-- está vazia, verificado antes desta migration: select count(*) = 0).
-- Estende o schema para o que o fluxo de geração/edição/aprovação precisa:
-- título legível, referência ao template da biblioteca C1.1, assessment de
-- origem (personalização C1.2.a) e o dado de minutos economizados (C1.3.a).

alter table deliverables
  add column titulo text not null default '',
  add column template_base_id text not null default '',
  add column assessment_id uuid references assessments(id),
  add column tempo_manual_estimado_minutos integer;

-- Remove os defaults transitórios: existiam só para permitir adicionar
-- colunas NOT NULL numa tabela que, mesmo vazia, o Postgres exige um
-- valor por linha existente durante o ALTER. Da próxima linha em diante,
-- a aplicação é obrigada a fornecer os dois campos (nenhuma linha real
-- jamais teve o default aplicado, tabela confirmada vazia antes desta
-- migration).
alter table deliverables
  alter column titulo drop default,
  alter column template_base_id drop default;

create index if not exists deliverables_assessment_id_idx on deliverables (assessment_id);

comment on column deliverables.template_base_id is
  'Referência à biblioteca estática de templates (spec C1.1, src/lib/entregaveis/templates.ts) — não é FK de banco, a biblioteca vive no código.';
comment on column deliverables.tempo_manual_estimado_minutos is
  'Capturado ao aprovar (spec C1.3.a): quanto tempo o entregável levaria sem IA. Opcional — não bloqueia a aprovação.';
