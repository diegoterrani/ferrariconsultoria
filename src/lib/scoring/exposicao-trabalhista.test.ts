import { describe, expect, it } from "vitest";
import { calcularScoreExposicaoTrabalhista, type RespostasAssessment } from "./exposicao-trabalhista";

// Teste obrigatório #3 (especificacao_plataforma_dev.md, seção 9):
// "o mesmo conjunto de respostas do assessment sempre produz o mesmo
// score — teste de regressão simples, sem chamada a IA ou serviço externo
// envolvido nesse cálculo." Este teste bloqueia merge se falhar (ver
// .github/workflows/ci.yml).

const respostasBase: RespostasAssessment = {
  regime: "12x36",
  gestaoGorjetas: "informal",
  bancoDeHoras: false,
  historicoFiscalizacao: true,
  rhFormalizado: false,
  rotatividadePercebida: 4,
};

describe("calcularScoreExposicaoTrabalhista — determinismo (teste obrigatório #3)", () => {
  it("produz o mesmo score para as mesmas respostas, em chamadas repetidas", () => {
    const resultados = Array.from({ length: 5 }, () =>
      calcularScoreExposicaoTrabalhista(respostasBase),
    );

    const scores = resultados.map((r) => r.score);
    expect(new Set(scores).size).toBe(1);
  });

  it("é uma função pura: mesma entrada, mesma lista de fatores, em qualquer ordem de execução", () => {
    const a = calcularScoreExposicaoTrabalhista(respostasBase);
    const b = calcularScoreExposicaoTrabalhista({ ...respostasBase });
    expect(a).toEqual(b);
  });

  it("nunca excede 100, mesmo no pior cenário combinado", () => {
    const piorCaso: RespostasAssessment = {
      regime: "outro",
      gestaoGorjetas: "nao_ha",
      bancoDeHoras: false,
      historicoFiscalizacao: true,
      rhFormalizado: false,
      rotatividadePercebida: 5,
    };
    expect(calcularScoreExposicaoTrabalhista(piorCaso).score).toBeLessThanOrEqual(100);
  });

  it("regime formalizado e sem histórico de fiscalização produz score baixo", () => {
    const melhorCaso: RespostasAssessment = {
      regime: "6x1",
      gestaoGorjetas: "formal",
      bancoDeHoras: true,
      historicoFiscalizacao: false,
      rhFormalizado: true,
      rotatividadePercebida: 1,
    };
    expect(calcularScoreExposicaoTrabalhista(melhorCaso).score).toBe(0);
  });

  it("cada fator retornado tem uma explicação textual (spec: resultado deve ser explicável ao cliente)", () => {
    const resultado = calcularScoreExposicaoTrabalhista(respostasBase);
    for (const fator of resultado.fatores) {
      expect(fator.fator.length).toBeGreaterThan(0);
      expect(fator.pontos).toBeGreaterThan(0);
    }
  });
});
