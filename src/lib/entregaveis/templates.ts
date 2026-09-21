/**
 * Biblioteca de templates (módulo C1.1, PRD seção "Drill-down dos 3 módulos
 * de Prioridade 1").
 *
 * Cada entrada é um "ponto de partida", não o texto final (spec C1.1: "como
 * ponto de partida, não texto final") — o `briefing` guia a geração por IA
 * em `lib/ai-provider.ts`, personalizada com o contexto do assessment
 * (segmento, porte, regime de jornada). O conteúdo final sempre passa pela
 * revisão humana obrigatória (spec 8.3) antes de poder ser enviado.
 */

export type TipoEntregavel = "descricao_cargo" | "politica_interna" | "material_onboarding";

/** Rótulo legível de cada tipo — fonte única usada no prompt de IA, no título do entregável e nos selects da UI. */
export const LABELS_TIPO: Record<TipoEntregavel, string> = {
  descricao_cargo: "Descrição de cargo",
  politica_interna: "Política interna",
  material_onboarding: "Material de onboarding",
};

export interface TemplateEntregavel {
  id: string;
  tipo: TipoEntregavel;
  nome: string;
  briefing: string;
}

export const TEMPLATES_ENTREGAVEIS: TemplateEntregavel[] = [
  // C1.1.a — descrições de cargo, funções típicas de gastronomia/hotelaria.
  {
    id: "cargo-cozinheiro",
    tipo: "descricao_cargo",
    nome: "Cozinheiro(a)",
    briefing:
      "Descrição de cargo para cozinheiro(a) em cozinha profissional: responsabilidades " +
      "de preparo, mise en place, segurança alimentar (boas práticas, APPCC), requisitos " +
      "de experiência e formação, e condições de trabalho típicas do regime de jornada do " +
      "estabelecimento.",
  },
  {
    id: "cargo-garcom",
    tipo: "descricao_cargo",
    nome: "Garçom/Garçonete",
    briefing:
      "Descrição de cargo para garçom/garçonete: atendimento ao cliente, gestão de " +
      "comandas, conhecimento de cardápio, higiene e apresentação, e como a política de " +
      "gorjetas do estabelecimento se aplica à remuneração da função.",
  },
  {
    id: "cargo-recepcionista-hotel",
    tipo: "descricao_cargo",
    nome: "Recepcionista de hotel",
    briefing:
      "Descrição de cargo para recepcionista de hotel: check-in/check-out, atendimento " +
      "multicanal, gestão de reservas, escala de plantão (turnos, cobertura de feriados) " +
      "e requisitos de idiomas quando aplicável ao porte do estabelecimento.",
  },
  {
    id: "cargo-governanta",
    tipo: "descricao_cargo",
    nome: "Governanta/Camareira",
    briefing:
      "Descrição de cargo para governanta/camareira: padrões de limpeza e arrumação, " +
      "gestão de enxoval e insumos, rotina de vistoria de quartos/áreas comuns, e a " +
      "relação hierárquica com a supervisão de governança.",
  },
  // C1.1.b — políticas internas: ponto de partida, nunca texto jurídico final.
  {
    id: "politica-conduta",
    tipo: "politica_interna",
    nome: "Código de conduta",
    briefing:
      "Código de conduta interno: relacionamento entre colaboradores e com clientes, " +
      "uso de uniforme e apresentação pessoal, política de tolerância a assédio e " +
      "discriminação, e o canal interno para reportar violações.",
  },
  {
    id: "politica-escala",
    tipo: "politica_interna",
    nome: "Política de escala e jornada",
    briefing:
      "Política interna de escala e jornada de trabalho, alinhada ao regime informado " +
      "no assessment (12x36, 6x1 ou outro): regras de troca de turno, intervalo, banco " +
      "de horas (quando houver) e comunicação de escala com antecedência mínima.",
  },
  {
    id: "politica-gorjetas",
    tipo: "politica_interna",
    nome: "Política de gorjetas e rateio",
    briefing:
      "Política de gestão e rateio de gorjetas/taxa de serviço: critério de distribuição " +
      "entre a equipe, periodicidade de repasse, e registro do processo — alinhada ao " +
      "modelo de gestão de gorjetas informado no assessment (formal, informal ou ausente).",
  },
  // C1.1.c — materiais de onboarding, a partir do ferramental da fundadora.
  {
    id: "onboarding-checklist",
    tipo: "material_onboarding",
    nome: "Checklist de integração (primeiros 30 dias)",
    briefing:
      "Checklist de integração do novo colaborador para os primeiros 30 dias: " +
      "documentação admissional, apresentação da equipe e das instalações, treinamento " +
      "das rotinas essenciais do cargo, e marcos de acompanhamento (1ª semana, 15 dias, 30 dias).",
  },
  {
    id: "onboarding-trilha-carreira",
    tipo: "material_onboarding",
    nome: "Trilha de carreira inicial",
    briefing:
      "Trilha de carreira inicial para a função: competências a desenvolver nos primeiros " +
      "meses, marcos de evolução dentro do cargo, e critério objetivo para elegibilidade " +
      "a promoção ou mudança de função dentro da estrutura do estabelecimento.",
  },
];

export function templatesPorTipo(tipo: TipoEntregavel): TemplateEntregavel[] {
  return TEMPLATES_ENTREGAVEIS.filter((t) => t.tipo === tipo);
}

export function buscarTemplate(id: string): TemplateEntregavel | undefined {
  return TEMPLATES_ENTREGAVEIS.find((t) => t.id === id);
}
