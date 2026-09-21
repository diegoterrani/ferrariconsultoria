/**
 * Tradução do score numérico (lib/scoring/exposicao-trabalhista.ts) para
 * texto de interface — deliberadamente FORA do módulo de scoring (seu
 * próprio comentário diz: "a tradução para texto é responsabilidade da
 * camada de apresentação, nunca deste arquivo").
 *
 * Regra de linguagem obrigatória (spec seção 8.4): nunca afirmar ou
 * implicar conformidade/irregularidade. "nível de atenção", nunca "sua
 * empresa está regular/irregular". Vale pra qualquer tela que mostre score,
 * indicador ou resultado — não só aqui.
 */

export type NivelAtencao = "baixo" | "moderado" | "elevado";

// Faixas arbitradas (não vêm da spec, que não numera limiares) — 3 faixas
// iguais sobre o intervalo 0-100 do score. Ponto de ajuste único e
// documentado se o negócio quiser recalibrar depois de ver dado real.
export function nivelAtencao(score: number): NivelAtencao {
  if (score < 34) return "baixo";
  if (score < 67) return "moderado";
  return "elevado";
}

const TEXTO: Record<NivelAtencao, string> = {
  baixo: "Nível de atenção baixo — poucos pontos que merecem revisão neste momento.",
  moderado: "Nível de atenção moderado — alguns pontos que merecem revisão.",
  elevado: "Nível de atenção elevado — vários pontos que merecem revisão prioritária.",
};

export function textoNivelAtencao(score: number): string {
  return TEXTO[nivelAtencao(score)];
}
