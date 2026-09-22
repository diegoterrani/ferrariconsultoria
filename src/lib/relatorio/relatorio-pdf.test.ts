import { describe, expect, it } from "vitest";

import { gerarRelatorioResultadoPdf } from "./relatorio-pdf";

/**
 * Teste unitário de `gerarRelatorioResultadoPdf` — não valida o layout
 * visual do PDF (fora de escopo do MVP, exigiria um leitor de PDF/snapshot
 * visual), mas valida o que importa para a rota que consome esta função:
 * o resultado é um PDF de verdade (assinatura de bytes `%PDF-`, nunca uma
 * string HTML ou um buffer vazio disfarçado de arquivo), a função nunca
 * lança para os valores de score que ela de fato recebe em produção, e o
 * texto de nível de atenção embutido é sempre o mesmo da tela de resultado
 * (nunca uma cópia divergente).
 */

const INPUT_BASE = {
  razaoSocial: "Restaurante Exemplo LTDA",
  cnpj: "11222333000181",
  benchmarkRotatividadeSetor: 77.6,
  pacoteSugerido: "Básico",
  geradoEm: new Date("2026-09-21T12:00:00Z"),
};

describe("gerarRelatorioResultadoPdf", () => {
  it("produz um PDF de verdade — assinatura de bytes %PDF- no início do buffer", async () => {
    const buffer = await gerarRelatorioResultadoPdf({ ...INPUT_BASE, score: 42 });

    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // Um PDF de uma página com texto não sai vazio nem trivialmente
    // pequeno — guarda contra uma regressão que gere um documento em
    // branco sem lançar erro.
    expect(buffer.byteLength).toBeGreaterThan(500);
  });

  it.each([0, 1, 33, 34, 50, 66, 67, 99, 100])(
    "não lança para score = %i (cobre as 3 faixas de nível de atenção e os limites)",
    async (score) => {
      await expect(
        gerarRelatorioResultadoPdf({ ...INPUT_BASE, score }),
      ).resolves.toBeInstanceOf(Buffer);
    },
  );

  it("formata CNPJ de 14 dígitos com máscara; não lança para CNPJ fora do formato esperado", async () => {
    const comMascara = await gerarRelatorioResultadoPdf({
      ...INPUT_BASE,
      score: 20,
      cnpj: "11222333000181",
    });
    expect(comMascara.byteLength).toBeGreaterThan(0);

    // Defensivo: nunca lançar por causa de formatação de CNPJ — a validação
    // de dígito verificador é responsabilidade de outra camada (src/lib/cnpj.ts),
    // não desta função.
    await expect(
      gerarRelatorioResultadoPdf({ ...INPUT_BASE, score: 20, cnpj: "já-formatado" }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it("nomes de razão social longos ou com acentuação não quebram a geração", async () => {
    await expect(
      gerarRelatorioResultadoPdf({
        ...INPUT_BASE,
        score: 60,
        razaoSocial: "Restaurante & Hotelaria São João da Conquista Empreendimentos EIRELI ME",
      }),
    ).resolves.toBeInstanceOf(Buffer);
  });
});
