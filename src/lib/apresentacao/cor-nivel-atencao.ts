import type { NivelAtencao } from "./nivel-atencao";

/**
 * Cor semântica por nível de atenção — mesma paleta da identidade visual
 * da marca (identidade_visual.html: "sálvia — status 'em dia', conformidade
 * OK — nunca decorativo" / "alerta — risco, pendência, exposição
 * trabalhista — nunca decorativo"). Fonte única para as duas telas que
 * mostram nível de atenção com cor: o selo na tela de resultado (web) e o
 * relatório em PDF (`src/lib/relatorio/relatorio-pdf.ts`) — antes desta
 * mudança cada uma tinha sua própria constante de cor duplicada (mesmos
 * três valores genéricos de verde/âmbar/vermelho, definidos duas vezes).
 *
 * Dois formatos, um propósito diferente cada:
 *   - `HEX_POR_NIVEL`: hex fixo, para o PDF — papel impresso não tem "modo
 *     escuro do navegador", então o PDF sempre usa os valores de modo claro
 *     da marca.
 *   - `VAR_POR_NIVEL`: `var(--sage)` etc., para a tela web — a mesma
 *     variável CSS já troca de valor sozinha sob `prefers-color-scheme:
 *     dark` (ver `src/app/globals.css`), então o selo na tela de resultado
 *     acompanha o tema do navegador sem lógica extra.
 */
export const HEX_POR_NIVEL: Record<NivelAtencao, string> = {
  baixo: "#5F7350",
  moderado: "#A87A2A",
  elevado: "#A83232",
};

export const VAR_POR_NIVEL: Record<NivelAtencao, string> = {
  baixo: "var(--sage)",
  moderado: "var(--gold)",
  elevado: "var(--danger)",
};
