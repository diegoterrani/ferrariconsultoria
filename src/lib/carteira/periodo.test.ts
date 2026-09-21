import { describe, expect, it } from "vitest";

import { competenciaAtual, inicioFimMesCorrente } from "./periodo";

describe("inicioFimMesCorrente", () => {
  it("início é dia 1 00:00 UTC, fim é dia 1 do mês seguinte (exclusivo)", () => {
    const referencia = new Date(Date.UTC(2026, 8, 21)); // 21/09/2026
    const { inicio, fim } = inicioFimMesCorrente(referencia);

    expect(inicio.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("dezembro vira janeiro do ano seguinte corretamente", () => {
    const referencia = new Date(Date.UTC(2026, 11, 15)); // 15/12/2026
    const { fim } = inicioFimMesCorrente(referencia);
    expect(fim.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("competenciaAtual", () => {
  it("formata como AAAA-MM com mês em 2 dígitos", () => {
    expect(competenciaAtual(new Date(Date.UTC(2026, 8, 21)))).toBe("2026-09");
    expect(competenciaAtual(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01");
  });
});
