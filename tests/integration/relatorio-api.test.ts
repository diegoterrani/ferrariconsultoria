import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes de integração de GET /api/assessments/[id]/relatorio (spec seção
 * 6.1 — "Gerar relatório em PDF"). Mesmo padrão dos outros arquivos de
 * integração deste repo: `@/lib/auth` e `@/lib/db` mockados (não precisa de
 * banco real), e aqui também `@/lib/relatorio/relatorio-pdf` mockado — a
 * geração de PDF em si (conteúdo, formatação, nunca lançar para os scores
 * possíveis) já é coberta por `src/lib/relatorio/relatorio-pdf.test.ts`;
 * este arquivo cobre o contrato da ROTA: autenticação, isolamento de
 * tenant, os estados 404/409, e os headers HTTP corretos para preview vs.
 * download.
 *
 * NÃO COBRE (mesma ressalva de sempre): se a policy RLS do Postgres
 * realmente impede um tenant de ler o assessment de outro — isso é
 * `tests/integration/tenant-isolation.test.ts` (teste obrigatório #1),
 * pulado até `DATABASE_URL_TEST` existir.
 */

type SessionUser = { role: "admin" | "staff" | "client_owner"; tenantId: string | null };

const authMock = vi.fn<(...args: unknown[]) => Promise<{ user: SessionUser } | null>>();
const withTenantContextMock = vi.fn();
const gerarRelatorioResultadoPdfMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ withTenantContext: withTenantContextMock }));
vi.mock("@/lib/relatorio/relatorio-pdf", () => ({
  gerarRelatorioResultadoPdf: gerarRelatorioResultadoPdfMock,
}));

function sessionAs(user: SessionUser | null) {
  authMock.mockResolvedValue(user ? { user } : null);
}

function getRequest(url: string) {
  return new Request(url);
}

const ADMIN: SessionUser = { role: "admin", tenantId: null };

const ASSESSMENT_ID = "00000000-0000-4000-8000-000000000010";

const TENANT = {
  id: "00000000-0000-4000-8000-000000000011",
  razaoSocial: "Restaurante Exemplo",
  cnpj: "11222333000181",
};

const ASSESSMENT_CONCLUIDO = {
  id: ASSESSMENT_ID,
  tenantId: TENANT.id,
  tenant: TENANT,
  respostas: { step1: { razaoSocial: "Restaurante Exemplo" } },
  status: "concluido",
  scoreExposicao: 42,
};

function mockTx(overrides: {
  assessment?: unknown;
  pipelineLead?: { pacoteSugerido: string | null } | null;
}) {
  withTenantContextMock.mockImplementation(async (ctx, fn) =>
    fn({
      assessment: { findUnique: vi.fn().mockResolvedValue(overrides.assessment ?? null) },
      pipelineLead: { findFirst: vi.fn().mockResolvedValue(overrides.pipelineLead ?? null) },
    }),
  );
}

beforeEach(() => {
  authMock.mockReset();
  withTenantContextMock.mockReset();
  gerarRelatorioResultadoPdfMock.mockReset();
  gerarRelatorioResultadoPdfMock.mockResolvedValue(Buffer.from("%PDF-fake-conteudo-de-teste"));
});

describe("GET /api/assessments/[id]/relatorio", () => {
  it("401 sem sessão, e nunca chega a tocar o banco nem a gerar PDF", async () => {
    sessionAs(null);
    const { GET } = await import("@/app/api/assessments/[id]/relatorio/route");

    const res = await GET(getRequest(`http://localhost/api/assessments/${ASSESSMENT_ID}/relatorio`), {
      params: Promise.resolve({ id: ASSESSMENT_ID }),
    });

    expect(res.status).toBe(401);
    expect(withTenantContextMock).not.toHaveBeenCalled();
    expect(gerarRelatorioResultadoPdfMock).not.toHaveBeenCalled();
  });

  it("404 quando o assessment não existe (ou pertence a outro tenant — RLS já filtrou)", async () => {
    sessionAs(ADMIN);
    mockTx({ assessment: null });
    const { GET } = await import("@/app/api/assessments/[id]/relatorio/route");

    const res = await GET(getRequest(`http://localhost/api/assessments/${ASSESSMENT_ID}/relatorio`), {
      params: Promise.resolve({ id: ASSESSMENT_ID }),
    });

    expect(res.status).toBe(404);
    expect(gerarRelatorioResultadoPdfMock).not.toHaveBeenCalled();
  });

  it("409 quando o diagnóstico ainda não foi calculado (status != concluido)", async () => {
    sessionAs(ADMIN);
    mockTx({ assessment: { ...ASSESSMENT_CONCLUIDO, status: "rascunho", scoreExposicao: null } });
    const { GET } = await import("@/app/api/assessments/[id]/relatorio/route");

    const res = await GET(getRequest(`http://localhost/api/assessments/${ASSESSMENT_ID}/relatorio`), {
      params: Promise.resolve({ id: ASSESSMENT_ID }),
    });

    expect(res.status).toBe(409);
    expect(gerarRelatorioResultadoPdfMock).not.toHaveBeenCalled();
  });

  it("200 com Content-Disposition: attachment por padrão (\"Baixar\")", async () => {
    sessionAs(ADMIN);
    mockTx({ assessment: ASSESSMENT_CONCLUIDO, pipelineLead: null });
    const { GET } = await import("@/app/api/assessments/[id]/relatorio/route");

    const res = await GET(getRequest(`http://localhost/api/assessments/${ASSESSMENT_ID}/relatorio`), {
      params: Promise.resolve({ id: ASSESSMENT_ID }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(TENANT.cnpj);
    // Sem PipelineLead ainda: cai no mesmo default "Básico" que a UI usa.
    expect(gerarRelatorioResultadoPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({ pacoteSugerido: "Básico" }),
    );
  });

  it("200 com Content-Disposition: inline quando ?preview=1 (\"preview\")", async () => {
    sessionAs(ADMIN);
    mockTx({ assessment: ASSESSMENT_CONCLUIDO });
    const { GET } = await import("@/app/api/assessments/[id]/relatorio/route");

    const res = await GET(
      getRequest(`http://localhost/api/assessments/${ASSESSMENT_ID}/relatorio?preview=1`),
      { params: Promise.resolve({ id: ASSESSMENT_ID }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("inline");
  });

  it("usa o pacoteSugerido do PipelineLead mais recente quando existe (nunca inventa dado novo)", async () => {
    sessionAs(ADMIN);
    mockTx({ assessment: ASSESSMENT_CONCLUIDO, pipelineLead: { pacoteSugerido: "Premium" } });
    const { GET } = await import("@/app/api/assessments/[id]/relatorio/route");

    await GET(getRequest(`http://localhost/api/assessments/${ASSESSMENT_ID}/relatorio`), {
      params: Promise.resolve({ id: ASSESSMENT_ID }),
    });

    expect(gerarRelatorioResultadoPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({ pacoteSugerido: "Premium" }),
    );
  });

  it("502 explícito se a geração do PDF falhar — nunca um 500 genérico nem um arquivo corrompido", async () => {
    sessionAs(ADMIN);
    mockTx({ assessment: ASSESSMENT_CONCLUIDO });
    gerarRelatorioResultadoPdfMock.mockRejectedValue(new Error("falha simulada de geração"));
    const { GET } = await import("@/app/api/assessments/[id]/relatorio/route");

    const res = await GET(getRequest(`http://localhost/api/assessments/${ASSESSMENT_ID}/relatorio`), {
      params: Promise.resolve({ id: ASSESSMENT_ID }),
    });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("falha simulada de geração");
  });

  it("o contexto de tenant vem sempre da sessão, nunca da URL", async () => {
    sessionAs({ role: "client_owner", tenantId: "tenant-da-sessao" });
    mockTx({ assessment: ASSESSMENT_CONCLUIDO });
    const { GET } = await import("@/app/api/assessments/[id]/relatorio/route");

    await GET(getRequest(`http://localhost/api/assessments/${ASSESSMENT_ID}/relatorio`), {
      params: Promise.resolve({ id: ASSESSMENT_ID }),
    });

    const ctxRecebido = withTenantContextMock.mock.calls[0][0];
    expect(ctxRecebido).toEqual({ role: "client_owner", tenantId: "tenant-da-sessao" });
  });
});
