import { describe, expect, it } from "vitest";

/**
 * Teste obrigatório #2 (especificacao_plataforma_dev.md, seção 9):
 * "tentar transicionar de rascunho direto para enviado, pulando
 * em_revisao/aprovado, via chamada direta à API, deve ser rejeitado pelo
 * backend." Implementa a regra de negócio da seção 8.3 (revisão humana
 * obrigatória como máquina de estados, não política de UI).
 *
 * STATUS HONESTO: precisa da rota de API de deliverables (módulo C1, ainda
 * não implementado) — este arquivo fica pulado até lá. Mesmo aviso de
 * tenant-isolation.test.ts se aplica: não fingir cobertura verde.
 */
const apiDisponivel = Boolean(process.env.DATABASE_URL_TEST);

describe.skipIf(!apiDisponivel)("Máquina de estados de Deliverable (teste obrigatório #2)", () => {
  it.todo("rascunho → enviado direto, via API, é rejeitado (400/409)");
  it.todo("em_revisao → aprovado só por ação explícita de usuário role admin/staff autenticado");
  it.todo("aprovado → enviado é a única transição que dispara o envio real ao cliente");
  it.todo("nenhuma transição pula estados mesmo chamando a API direto, fora da UI");
});

if (!apiDisponivel) {
  describe("Máquina de estados de Deliverable — aviso de status", () => {
    it("está pulado nesta execução: implementar junto com a API do módulo C1 (PRD, Prioridade 1)", () => {
      expect(apiDisponivel).toBe(false);
    });
  });
}
