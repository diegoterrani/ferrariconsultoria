import { describe, expect, it } from "vitest";

import { PACOTES, isPacoteValido } from "./pacotes";

describe("isPacoteValido", () => {
  it("aceita as 3 chaves de PACOTES", () => {
    for (const nome of Object.keys(PACOTES)) {
      expect(isPacoteValido(nome)).toBe(true);
    }
  });

  it("rejeita null, string vazia e nome fora da tabela", () => {
    expect(isPacoteValido(null)).toBe(false);
    expect(isPacoteValido("")).toBe(false);
    expect(isPacoteValido("Pacote Inexistente")).toBe(false);
  });
});

describe("PACOTES — tabela de preços (spec seção 11)", () => {
  it("Implantação não tem horas mensais fixas (projeto de 3-6 meses, não horas/mês)", () => {
    expect(PACOTES.Implantação.horasIncluidas).toBeNull();
  });

  it("Básico e Premium têm horas mensais > 0", () => {
    expect(PACOTES.Básico.horasIncluidas).toBeGreaterThan(0);
    expect(PACOTES.Premium.horasIncluidas).toBeGreaterThan(0);
  });
});
