import { describe, expect, it } from "vitest";

/**
 * Teste obrigatório #1 (especificacao_plataforma_dev.md, seção 9):
 * "autenticado como usuário do tenant A, tentar ler/editar um recurso do
 * tenant B (por ID direto na URL da API, não só pela UI) deve retornar
 * 403/404, nunca o dado. Rodar para toda entidade com tenant_id."
 *
 * STATUS HONESTO: este teste precisa de um projeto Supabase real com a
 * migration 0001_multi_tenant_rls.sql aplicada — não roda contra um mock,
 * porque o que ele valida é a policy RLS no banco de verdade, não a lógica
 * da aplicação (essa é exatamente a garantia da seção 4: a aplicação
 * sozinha NÃO deve ser a única barreira). Fica pulado até a variável
 * DATABASE_URL_TEST apontar para o projeto Supabase de teste/staging — ver
 * .github/workflows/ci.yml e seção 10 da spec ("dado real nunca em local ou
 * staging"; este teste usa dado sintético).
 *
 * Não marcar como passando sem essa infraestrutura: um teste verde que não
 * testou nada é pior que um teste pulado e sinalizado.
 */
const dbDisponivel = Boolean(process.env.DATABASE_URL_TEST);

describe.skipIf(!dbDisponivel)("Isolamento de tenant via RLS (teste obrigatório #1)", () => {
  it.todo("tenant A não lê um assessment do tenant B por ID direto na API");
  it.todo("tenant A não edita um deliverable do tenant B por ID direto na API");
  it.todo("role admin lê recursos de qualquer tenant");
  it.todo("requisição sem tenant_id resolvido (JWT ausente/ inválido) retorna vazio, nunca todos os tenants");
});

if (!dbDisponivel) {
  describe("Isolamento de tenant — aviso de status", () => {
    it("está pulado nesta execução: defina DATABASE_URL_TEST para rodar contra um Supabase real", () => {
      expect(dbDisponivel).toBe(false); // documenta o estado atual, não finge cobertura
    });
  });
}
