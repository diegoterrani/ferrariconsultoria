/**
 * Classes Tailwind compartilhadas — botão, campo, cartão, modal.
 *
 * Antes da identidade visual, cada arquivo repetia a mesma string longa
 * (ex.: `"rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white
 * disabled:opacity-40 dark:bg-white dark:text-neutral-900"`) — contei ~140
 * ocorrências desse tipo de duplicação em ~20 arquivos antes desta mudança.
 * Centralizar aqui não é só estética: é a diferença entre mudar a cor de
 * botão primário da marca em um lugar ou em vinte, e evita o desvio visual
 * gradual que duplicação sempre convida (um arquivo atualizado, outro
 * esquecido). Cada export é só uma string de classes — sem componente,
 * sem prop, sem mudança de comportamento — pra manter o risco desta troca
 * de marca restrito a estilo, nunca a lógica.
 */

export const botaoPrimario =
  "rounded-md bg-wine-deep px-4 py-2 text-sm font-medium text-on-brand transition-colors hover:bg-wine disabled:opacity-40 disabled:hover:bg-wine-deep";

export const botaoPrimarioPequeno =
  "rounded-md bg-wine-deep px-3 py-1.5 text-xs font-medium text-on-brand transition-colors hover:bg-wine disabled:opacity-40 disabled:hover:bg-wine-deep";

/**
 * Variante só para um botão primário que fica montado direto sobre fundo
 * vinho-noite (hoje, só o cabeçalho — ver `(app)/layout.tsx`): nesse caso
 * `botaoPrimarioPequeno` (também vinho-noite) ficaria invisível sobre o
 * próprio fundo. Ouro é a cor de acento/destaque da marca ("um acento por
 * peça") — aqui o acento é a própria ação global "+ Registrar horas".
 */
export const botaoPrimarioSobreVinhoPequeno =
  "rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-wine-deep transition-colors hover:bg-gold-bright disabled:opacity-40 disabled:hover:bg-gold";

export const botaoSecundario =
  "rounded-md border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent";

export const botaoSecundarioPequeno =
  "rounded-md border border-line px-3 py-1.5 text-xs text-ink transition-colors hover:bg-surface-2 disabled:opacity-40";

export const campoInput = "rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink";
export const campoInputPequeno = "rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink";
export const rotuloCampo = "text-sm font-medium text-ink-soft";

export const cartao = "rounded-lg border border-line bg-surface";
export const tabelaContainer = "overflow-x-auto rounded-lg border border-line";
export const tabelaCabecalho = "border-b border-line text-xs text-ink-soft";
export const tabelaLinha = "border-b border-line/60 last:border-0";

export const modalOverlay = "fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4";
export const modalPainel = "flex w-full flex-col gap-4 rounded-lg bg-surface p-6 shadow-lg";

export const textoSecundario = "text-sm text-ink-soft";
export const textoErro = "text-sm text-danger";
export const textoSucesso = "text-sm text-sage";
