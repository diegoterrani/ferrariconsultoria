/**
 * Score de exposição trabalhista (módulo B1.2.a).
 *
 * Fonte: especificacao_plataforma_dev.md, seção 6.1 — "chamada síncrona a
 * uma função determinística de scoring (não é IA — é uma tabela de regras
 * versionada no código), porque o resultado precisa ser sempre igual para
 * as mesmas respostas e explicável se o cliente perguntar 'por que meu
 * score é esse'".
 *
 * Regra de linguagem (seção 8.4): o resultado nunca declara conformidade.
 * Este módulo só produz um número e os fatores que o compuseram — a
 * tradução para texto ("nível de atenção baixo/moderado/elevado") é
 * responsabilidade da camada de apresentação, nunca deste arquivo.
 */

export interface RespostasAssessment {
  /** Regime de jornada — do passo 3 do wizard (B1.1.c). */
  regime: "12x36" | "6x1" | "outro";
  /** Gestão de gorjetas — rateio formal reduz exposição; informal ou ausência aumenta. */
  gestaoGorjetas: "formal" | "informal" | "nao_ha";
  /** Banco de horas implementado corretamente reduz exposição de passivo trabalhista. */
  bancoDeHoras: boolean;
  /** Histórico de fiscalização ou processo trabalhista — do passo 2 (B1.1.b). */
  historicoFiscalizacao: boolean;
  /** RH formalizado hoje — ausência aumenta exposição (sem controle sistemático). */
  rhFormalizado: boolean;
  /** Rotatividade percebida, escala 1-5 (1 = baixa, 5 = alta). */
  rotatividadePercebida: 1 | 2 | 3 | 4 | 5;
}

export interface ResultadoScore {
  /** 0-100. Maior = mais exposição, nunca "mais irregular" (seção 8.4). */
  score: number;
  /** Cada fator e seus pontos — a explicabilidade que a spec exige. */
  fatores: { fator: string; pontos: number }[];
}

// Tabela de regras versionada — qualquer mudança de peso é uma mudança de
// código revisável (PR), nunca um valor editável em runtime/admin.
const PESOS = {
  regimeOutro: 12,
  gorjetasInformalOuAusente: 15,
  semBancoDeHoras: 10,
  historicoFiscalizacao: 25,
  semRhFormalizado: 18,
  // rotatividade: 4 pontos por nível acima de 1 (máx. 16 em rotatividade=5)
  rotatividadePorNivel: 4,
} as const;

export function calcularScoreExposicaoTrabalhista(
  respostas: RespostasAssessment,
): ResultadoScore {
  const fatores: { fator: string; pontos: number }[] = [];

  if (respostas.regime === "outro") {
    fatores.push({ fator: "Regime de jornada fora dos padrões comuns (12x36/6x1)", pontos: PESOS.regimeOutro });
  }

  if (respostas.gestaoGorjetas !== "formal") {
    fatores.push({
      fator:
        respostas.gestaoGorjetas === "informal"
          ? "Rateio de gorjetas informal"
          : "Sem rateio de gorjetas estabelecido",
      pontos: PESOS.gorjetasInformalOuAusente,
    });
  }

  if (!respostas.bancoDeHoras) {
    fatores.push({ fator: "Sem banco de horas implementado", pontos: PESOS.semBancoDeHoras });
  }

  if (respostas.historicoFiscalizacao) {
    fatores.push({ fator: "Histórico de fiscalização ou processo trabalhista", pontos: PESOS.historicoFiscalizacao });
  }

  if (!respostas.rhFormalizado) {
    fatores.push({ fator: "RH não formalizado", pontos: PESOS.semRhFormalizado });
  }

  const pontosRotatividade = (respostas.rotatividadePercebida - 1) * PESOS.rotatividadePorNivel;
  if (pontosRotatividade > 0) {
    fatores.push({ fator: `Rotatividade percebida nível ${respostas.rotatividadePercebida}/5`, pontos: pontosRotatividade });
  }

  const somaBruta = fatores.reduce((soma, f) => soma + f.pontos, 0);
  const score = Math.min(100, somaBruta);

  return { score, fatores };
}
