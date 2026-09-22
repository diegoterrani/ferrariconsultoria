/**
 * Componentes de marca — Ferrari Consultoria (fase f3_escopo_mvp,
 * identidade_visual.html, v2, aprovada por Eliane).
 *
 * Regra de uso do próprio documento de marca, respeitada aqui na letra:
 * "a logomarca completa (selo) é a única forma padrão da marca... o ícone
 * isolado é um recurso à parte, usado sozinho, apenas onde o selo completo
 * não cabe fisicamente... os dois nunca aparecem colados um ao outro."
 * Por isso são dois componentes deliberadamente separados — `Logomark`
 * (selo completo) e `LogoIcon` (ícone isolado) — e nenhum dos dois aceita
 * uma prop pra renderizar o outro ao lado. Quem for montar uma tela decide
 * qual dos dois usar, nunca os dois juntos.
 */

const TAMANHOS_LOGOMARK = {
  padrao: { padding: "px-7 py-4", word: "text-3xl", sub: "text-[0.68rem] tracking-[0.28em] mt-2" },
  sm: { padding: "px-4 py-2", word: "text-lg", sub: "text-[0.5rem] tracking-[0.22em] mt-1" },
} as const;

export function Logomark({
  size = "padrao",
  className = "",
}: {
  size?: keyof typeof TAMANHOS_LOGOMARK;
  className?: string;
}) {
  const t = TAMANHOS_LOGOMARK[size];
  return (
    <span
      className={`inline-flex flex-col items-center justify-center rounded-2xl bg-wine-deep ${t.padding} ${className}`}
    >
      <span className={`font-serif font-medium leading-none text-on-brand ${t.word}`}>Ferrari</span>
      <span className={`font-sans font-semibold uppercase text-gold-bright ${t.sub}`}>Consultoria</span>
    </span>
  );
}

/**
 * Ícone-arco isolado — exclusivo para favicon, avatar pequeno e ícone de
 * aplicativo (ver `src/app/icon.svg` para o favicon real). `stroke="currentColor"`
 * por padrão: herda a cor de texto do elemento pai, então funciona tanto
 * sobre fundo vinho-noite (defina `className="text-gold-bright"` no pai)
 * quanto sobre papel (`className="text-wine"`) sem precisar de uma prop de
 * cor dedicada.
 */
export function LogoIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M36,90 L36,24 C44,13 60,11 73,18" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36,54 L59,50" strokeWidth={7} strokeLinecap="round" />
    </svg>
  );
}
