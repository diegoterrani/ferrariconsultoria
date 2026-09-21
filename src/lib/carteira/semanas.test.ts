import { describe, expect, it } from "vitest";

import { inicioSemanaUTC, ultimasNSemanas } from "./semanas";

describe("inicioSemanaUTC", () => {
  it("uma terça-feira volta pra segunda da mesma semana", () => {
    // 2026-09-22 é uma terça (verificado via calendário ISO).
    const terca = new Date(Date.UTC(2026, 8, 22));
    const segunda = inicioSemanaUTC(terca);
    expect(segunda.toISOString().slice(0, 10)).toBe("2026-09-21");
  });

  it("um domingo volta pra segunda ANTERIOR (não a próxima)", () => {
    // 2026-09-27 é domingo — pertence à semana que começou em 21/09, não à seguinte.
    const domingo = new Date(Date.UTC(2026, 8, 27));
    const segunda = inicioSemanaUTC(domingo);
    expect(segunda.toISOString().slice(0, 10)).toBe("2026-09-21");
  });

  it("uma segunda-feira já é o próprio início", () => {
    const segunda = new Date(Date.UTC(2026, 8, 21));
    expect(inicioSemanaUTC(segunda).toISOString().slice(0, 10)).toBe("2026-09-21");
  });
});

describe("ultimasNSemanas", () => {
  it("retorna N segundas-feiras consecutivas, mais antiga primeiro", () => {
    const referencia = new Date(Date.UTC(2026, 8, 22)); // terça, semana de 21/09
    const semanas = ultimasNSemanas(4, referencia);

    expect(semanas).toHaveLength(4);
    expect(semanas[3].toISOString().slice(0, 10)).toBe("2026-09-21"); // semana atual, última do array
    expect(semanas[0].toISOString().slice(0, 10)).toBe("2026-08-31"); // 3 semanas antes

    // cada uma é exatamente 7 dias depois da anterior
    for (let i = 1; i < semanas.length; i++) {
      const diffDias = (semanas[i].getTime() - semanas[i - 1].getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDias).toBe(7);
    }
  });
});
