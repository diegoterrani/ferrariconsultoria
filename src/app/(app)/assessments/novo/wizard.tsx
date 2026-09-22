"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { formatarCnpj } from "@/lib/cnpj";
import { botaoPrimario, botaoSecundario, campoInput, rotuloCampo, textoErro } from "@/lib/ui/classes";
import { Passo1Schema, Passo2Schema, Passo3Schema } from "@/lib/validation/assessment";

/**
 * Wizard de 3 passos do diagnóstico (spec seção 6.1). Autosave a cada
 * mudança de passo: o passo 1 cria o registro (POST /api/assessments), os
 * passos seguintes fazem PATCH — perder o progresso fechando a aba sem
 * querer não pode acontecer, porque o dado já está no banco antes do botão
 * final.
 *
 * Não cobre nesta fatia: editar o passo 1 depois de já ter avançado (o
 * fluxo real é ao vivo, na frente do cliente, sequencial) — documentado
 * como corte de escopo, não bug.
 */

type Step1 = {
  razaoSocial: string;
  cnpj: string;
  porte: "pequeno" | "medio" | "grande" | "";
  numColaboradores: string;
  unidades: string[];
  segmento: "restaurante" | "hotel" | "outro" | "";
};

type Step2 = {
  rotatividadePercebida: string;
  historicoFiscalizacao: boolean | null;
  historicoFiscalizacaoDetalhe: string;
  rhFormalizado: boolean | null;
};

type Step3 = {
  regime: "12x36" | "6x1" | "outro" | "";
  regimeDetalhe: string;
  gestaoGorjetas: "formal" | "informal" | "nao_ha" | "";
  bancoDeHoras: boolean | null;
};

const STEP1_INICIAL: Step1 = {
  razaoSocial: "",
  cnpj: "",
  porte: "",
  numColaboradores: "",
  unidades: [""],
  segmento: "",
};
const STEP2_INICIAL: Step2 = {
  rotatividadePercebida: "",
  historicoFiscalizacao: null,
  historicoFiscalizacaoDetalhe: "",
  rhFormalizado: null,
};
const STEP3_INICIAL: Step3 = {
  regime: "",
  regimeDetalhe: "",
  gestaoGorjetas: "",
  bancoDeHoras: null,
};

function step1Valido(s: Step1) {
  return Passo1Schema.safeParse({
    ...s,
    numColaboradores: s.numColaboradores,
    unidades: s.unidades.filter((u) => u.trim().length > 0),
  }).success;
}
function step2Valido(s: Step2) {
  return Passo2Schema.safeParse(s).success;
}
function step3Valido(s: Step3) {
  return Passo3Schema.safeParse(s).success;
}

export function Wizard() {
  const router = useRouter();
  const [passoAtual, setPassoAtual] = useState<1 | 2 | 3>(1);
  const [step1, setStep1] = useState<Step1>(STEP1_INICIAL);
  const [step2, setStep2] = useState<Step2>(STEP2_INICIAL);
  const [step3, setStep3] = useState<Step3>(STEP3_INICIAL);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function avancarDoStep1() {
    if (!step1Valido(step1)) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...step1,
          unidades: step1.unidades.filter((u) => u.trim().length > 0),
        }),
      });
      if (!res.ok) throw new Error("Não foi possível salvar o passo 1.");
      const data = await res.json();
      setAssessmentId(data.id);
      setPassoAtual(2);
    } catch {
      setErro("Não foi possível salvar. Confira sua conexão e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function avancarDoStep2() {
    if (!step2Valido(step2) || !assessmentId) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step2 }),
      });
      if (!res.ok) throw new Error("Não foi possível salvar o passo 2.");
      setPassoAtual(3);
    } catch {
      setErro("Não foi possível salvar. Confira sua conexão e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function calcularDiagnostico() {
    if (!step3Valido(step3) || !assessmentId) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step3 }),
      });
      if (!res.ok) throw new Error("Não foi possível calcular o diagnóstico.");
      router.push(`/assessments/${assessmentId}/resultado`);
    } catch {
      setErro("Não foi possível calcular. Confira sua conexão e tente de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <BarraDeProgresso passoAtual={passoAtual} />

      <h1 className="text-xl font-semibold">Novo diagnóstico</h1>

      {passoAtual === 1 && <PassoDadosCadastrais valor={step1} onChange={setStep1} />}
      {passoAtual === 2 && <PassoMapeamentoDeDores valor={step2} onChange={setStep2} />}
      {passoAtual === 3 && <PassoJornadaEEscala valor={step3} onChange={setStep3} />}

      {erro && (
        <p role="alert" className={textoErro}>
          {erro}
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPassoAtual((p) => (p > 1 ? ((p - 1) as 1 | 2) : p))}
          disabled={passoAtual === 1 || salvando}
          className={botaoSecundario}
        >
          Voltar
        </button>

        {passoAtual < 3 ? (
          <button
            type="button"
            onClick={passoAtual === 1 ? avancarDoStep1 : avancarDoStep2}
            disabled={
              salvando || (passoAtual === 1 ? !step1Valido(step1) : !step2Valido(step2))
            }
            className={botaoPrimario}
          >
            {salvando ? "Salvando..." : "Avançar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={calcularDiagnostico}
            disabled={salvando || !step3Valido(step3)}
            className={botaoPrimario}
          >
            {salvando ? "Calculando..." : "Calcular diagnóstico"}
          </button>
        )}
      </div>
    </div>
  );
}

function BarraDeProgresso({ passoAtual }: { passoAtual: 1 | 2 | 3 }) {
  const rotulos = ["Dados cadastrais", "Mapeamento de dores", "Jornada e escala"];
  return (
    <div className="sticky top-0 z-10 -mx-4 bg-bg/90 px-4 py-3 backdrop-blur">
      <ol className="flex gap-2">
        {rotulos.map((rotulo, i) => {
          const numero = (i + 1) as 1 | 2 | 3;
          const ativo = numero === passoAtual;
          const concluido = numero < passoAtual;
          return (
            <li key={rotulo} className="flex flex-1 flex-col gap-1">
              <div
                className={`h-1.5 rounded-full ${
                  ativo || concluido ? "bg-wine-deep" : "bg-surface-2"
                }`}
              />
              <span className="text-xs text-ink-soft">
                {numero}. {rotulo}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// `<label>` envolve o campo (em vez de `htmlFor`/`id`) — associação implícita
// que funciona sem coordenar ids únicos entre os passos do wizard, e é o que
// torna os campos localizáveis por rótulo em teste (`getByLabel`), inclusive
// no teste E2E obrigatório #4 (tests/e2e/diagnostico-completo.spec.ts). Antes
// desta correção o `<label>` só envolvia o texto, sem associação nenhuma com
// o input — gap de acessibilidade real, não só um problema de teste.
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={rotuloCampo}>{label}</span>
      {children}
    </label>
  );
}

const inputClasses = campoInput;

function PassoDadosCadastrais({
  valor,
  onChange,
}: {
  valor: Step1;
  onChange: (v: Step1) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Campo label="Razão social">
        <input
          className={inputClasses}
          value={valor.razaoSocial}
          onChange={(e) => onChange({ ...valor, razaoSocial: e.target.value })}
        />
      </Campo>

      <Campo label="CNPJ">
        <input
          className={inputClasses}
          value={valor.cnpj}
          placeholder="00.000.000/0000-00"
          onChange={(e) => onChange({ ...valor, cnpj: formatarCnpj(e.target.value) })}
        />
      </Campo>

      <Campo label="Porte">
        <select
          className={inputClasses}
          value={valor.porte}
          onChange={(e) => onChange({ ...valor, porte: e.target.value as Step1["porte"] })}
        >
          <option value="">Selecione</option>
          <option value="pequeno">Pequeno</option>
          <option value="medio">Médio</option>
          <option value="grande">Grande</option>
        </select>
      </Campo>

      <Campo label="Número de colaboradores">
        <input
          type="number"
          min={1}
          className={inputClasses}
          value={valor.numColaboradores}
          onChange={(e) => onChange({ ...valor, numColaboradores: e.target.value })}
        />
      </Campo>

      <Campo label="Unidades">
        <div className="flex flex-col gap-2">
          {valor.unidades.map((unidade, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={`${inputClasses} flex-1`}
                value={unidade}
                placeholder={`Unidade ${i + 1}`}
                onChange={(e) => {
                  const unidades = [...valor.unidades];
                  unidades[i] = e.target.value;
                  onChange({ ...valor, unidades });
                }}
              />
              {valor.unidades.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...valor, unidades: valor.unidades.filter((_, j) => j !== i) })
                  }
                  className="rounded-md border border-line px-3 text-sm text-ink hover:bg-surface-2"
                  aria-label={`Remover unidade ${i + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...valor, unidades: [...valor.unidades, ""] })}
            className="self-start text-sm text-ink-soft underline"
          >
            + adicionar unidade
          </button>
        </div>
      </Campo>

      <Campo label="Segmento">
        <div className="flex gap-4">
          {(["restaurante", "hotel", "outro"] as const).map((opcao) => (
            <label key={opcao} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="segmento"
                checked={valor.segmento === opcao}
                onChange={() => onChange({ ...valor, segmento: opcao })}
              />
              {opcao[0].toUpperCase() + opcao.slice(1)}
            </label>
          ))}
        </div>
      </Campo>
    </div>
  );
}

function PassoMapeamentoDeDores({
  valor,
  onChange,
}: {
  valor: Step2;
  onChange: (v: Step2) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Campo label="Rotatividade percebida (1 = baixa, 5 = alta)">
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="rotatividade"
                checked={valor.rotatividadePercebida === String(n)}
                onChange={() => onChange({ ...valor, rotatividadePercebida: String(n) })}
              />
              {n}
            </label>
          ))}
        </div>
      </Campo>

      <Campo label="Histórico de fiscalização ou processo trabalhista">
        <SimNao
          valor={valor.historicoFiscalizacao}
          onChange={(v) => onChange({ ...valor, historicoFiscalizacao: v })}
        />
      </Campo>
      {valor.historicoFiscalizacao === true && (
        <Campo label="Detalhe (opcional)">
          <textarea
            className={inputClasses}
            value={valor.historicoFiscalizacaoDetalhe}
            onChange={(e) => onChange({ ...valor, historicoFiscalizacaoDetalhe: e.target.value })}
          />
        </Campo>
      )}

      <Campo label="RH formalizado hoje">
        <SimNao valor={valor.rhFormalizado} onChange={(v) => onChange({ ...valor, rhFormalizado: v })} />
      </Campo>
    </div>
  );
}

function PassoJornadaEEscala({
  valor,
  onChange,
}: {
  valor: Step3;
  onChange: (v: Step3) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Campo label="Regime">
        <select
          className={inputClasses}
          value={valor.regime}
          onChange={(e) => onChange({ ...valor, regime: e.target.value as Step3["regime"] })}
        >
          <option value="">Selecione</option>
          <option value="12x36">12x36</option>
          <option value="6x1">6x1</option>
          <option value="outro">Outro</option>
        </select>
      </Campo>
      {valor.regime === "outro" && (
        <Campo label="Descreva o regime">
          <input
            className={inputClasses}
            value={valor.regimeDetalhe}
            onChange={(e) => onChange({ ...valor, regimeDetalhe: e.target.value })}
          />
        </Campo>
      )}

      <Campo label="Gestão de gorjetas">
        <div className="flex flex-col gap-1.5">
          {(
            [
              ["formal", "Rateio formal"],
              ["informal", "Rateio informal"],
              ["nao_ha", "Não há"],
            ] as const
          ).map(([valorOpcao, rotulo]) => (
            <label key={valorOpcao} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="gestaoGorjetas"
                checked={valor.gestaoGorjetas === valorOpcao}
                onChange={() => onChange({ ...valor, gestaoGorjetas: valorOpcao })}
              />
              {rotulo}
            </label>
          ))}
        </div>
      </Campo>

      <Campo label="Banco de horas">
        <SimNao valor={valor.bancoDeHoras} onChange={(v) => onChange({ ...valor, bancoDeHoras: v })} />
      </Campo>
    </div>
  );
}

function SimNao({
  valor,
  onChange,
}: {
  valor: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-4">
      <label className="flex items-center gap-1.5 text-sm">
        <input type="radio" checked={valor === true} onChange={() => onChange(true)} />
        Sim
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="radio" checked={valor === false} onChange={() => onChange(false)} />
        Não
      </label>
    </div>
  );
}
