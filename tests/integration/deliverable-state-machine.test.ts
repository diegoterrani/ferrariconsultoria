import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes de integração do módulo C1 (IA generativa de entregáveis) — mesmo
 * padrão de assessments-api.test.ts e carteira-api.test.ts: `@/lib/auth` e
 * `@/lib/db` mockados, sem precisar de banco real, mais `@/lib/ai-provider`
 * mockado (a chamada de rede à OpenRouter não deve rodar em teste).
 *
 * Este arquivo fecha o teste obrigatório #2 (especificacao_plataforma_dev.md,
 * seção 9): "tentar transicionar de rascunho direto para enviado, pulando
 * em_revisao/aprovado, via chamada direta à API, deve ser rejeitado pelo
 * backend" — a máquina de estados é lógica de aplicação pura em
 * api/deliverables/[id]/route.ts, não depende de RLS/banco real como o
 * teste obrigatório #1 (esse continua em tenant-isolation.test.ts, ainda
 * bloqueado por DATABASE_URL_TEST).
 */

type SessionUser = { role: "admin" | "staff" | "client_owner"; tenantId: string | null };

const authMock = vi.fn<(...args: unknown[]) => Promise<{ user: SessionUser } | null>>();
const withTenantContextMock = vi.fn();
const gerarEntregavelMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ withTenantContext: withTenantContextMock }));
vi.mock("@/lib/ai-provider", () => ({
  createAiProvider: () => ({ gerarEntregavel: gerarEntregavelMock }),
}));

function sessionAs(user: SessionUser | null) {
  authMock.mockResolvedValue(user ? { user } : null);
}

function jsonRequest(body: unknown, method = "POST") {
  return new Request("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ADMIN: SessionUser = { role: "admin", tenantId: null };
const CLIENT_OWNER: SessionUser = { role: "client_owner", tenantId: "tenant-a" };

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const ASSESSMENT_ID = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  authMock.mockReset();
  withTenantContextMock.mockReset();
  gerarEntregavelMock.mockReset();
});

describe("POST /api/deliverables (geração via IA)", () => {
  it("401 sem sessão, 403 para client_owner — nenhum toca o banco nem a IA", async () => {
    sessionAs(null);
    const { POST } = await import("@/app/api/deliverables/route");
    const body = { tenantId: TENANT_ID, tipo: "descricao_cargo", templateBaseId: "cargo-cozinheiro" };
    expect((await POST(jsonRequest(body))).status).toBe(401);
    expect(withTenantContextMock).not.toHaveBeenCalled();
    expect(gerarEntregavelMock).not.toHaveBeenCalled();

    sessionAs(CLIENT_OWNER);
    expect((await POST(jsonRequest(body))).status).toBe(403);
    expect(withTenantContextMock).not.toHaveBeenCalled();
    expect(gerarEntregavelMock).not.toHaveBeenCalled();
  });

  it("400 quando o template não existe ou não bate com o tipo informado", async () => {
    sessionAs(ADMIN);
    const { POST } = await import("@/app/api/deliverables/route");

    const inexistente = await POST(
      jsonRequest({ tenantId: TENANT_ID, tipo: "descricao_cargo", templateBaseId: "nao-existe" }),
    );
    expect(inexistente.status).toBe(400);

    // template "politica-conduta" é do tipo politica_interna, não descricao_cargo.
    const tipoErrado = await POST(
      jsonRequest({ tenantId: TENANT_ID, tipo: "descricao_cargo", templateBaseId: "politica-conduta" }),
    );
    expect(tipoErrado.status).toBe(400);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("404 quando o tenant não existe", async () => {
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({ tenant: { findUnique: vi.fn().mockResolvedValue(null) } }),
    );
    sessionAs(ADMIN);
    const { POST } = await import("@/app/api/deliverables/route");
    const res = await POST(
      jsonRequest({ tenantId: TENANT_ID, tipo: "descricao_cargo", templateBaseId: "cargo-cozinheiro" }),
    );
    expect(res.status).toBe(404);
    expect(gerarEntregavelMock).not.toHaveBeenCalled();
  });

  it("502 quando a IA falha, e NENHUM entregável é gravado (sem rascunho órfão)", async () => {
    const createMock = vi.fn();
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({
        tenant: { findUnique: vi.fn().mockResolvedValue({ id: TENANT_ID }) },
        deliverable: { create: createMock },
      }),
    );
    gerarEntregavelMock.mockRejectedValue(new Error("OPENROUTER_API_KEY ausente"));
    sessionAs(ADMIN);
    const { POST } = await import("@/app/api/deliverables/route");
    const res = await POST(
      jsonRequest({ tenantId: TENANT_ID, tipo: "descricao_cargo", templateBaseId: "cargo-cozinheiro" }),
    );
    expect(res.status).toBe(502);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("201: personaliza com o contexto do assessment e cria em status rascunho (default do schema, não forçado no código)", async () => {
    const createMock = vi.fn().mockImplementation(({ data }) => ({ id: "d1", status: "rascunho", ...data }));
    const respostasAssessment = { step1: { segmento: "restaurante" } };
    withTenantContextMock.mockImplementation(async (ctx, fn) => {
      expect(ctx).toEqual({ role: "admin", tenantId: null });
      return fn({
        tenant: { findUnique: vi.fn().mockResolvedValue({ id: TENANT_ID }) },
        assessment: {
          findUnique: vi.fn().mockResolvedValue({
            id: ASSESSMENT_ID,
            tenantId: TENANT_ID,
            respostas: respostasAssessment,
          }),
        },
        deliverable: { create: createMock },
      });
    });
    gerarEntregavelMock.mockResolvedValue({ conteudo: "# Rascunho gerado", aprovadoAutomaticamente: false });

    sessionAs(ADMIN);
    const { POST } = await import("@/app/api/deliverables/route");
    const res = await POST(
      jsonRequest({
        tenantId: TENANT_ID,
        tipo: "descricao_cargo",
        templateBaseId: "cargo-cozinheiro",
        assessmentId: ASSESSMENT_ID,
      }),
    );

    expect(res.status).toBe(201);
    expect(gerarEntregavelMock).toHaveBeenCalledWith(
      expect.objectContaining({ contextoAssessment: respostasAssessment }),
    );
    const body = await res.json();
    expect(body.status).toBe("rascunho");
    expect(body.conteudo).toBe("# Rascunho gerado");
    // `status` nunca é passado explicitamente na criação — depende só do
    // @default(rascunho) do schema, nunca de um valor decidido no código.
    expect(createMock.mock.calls[0][0].data.status).toBeUndefined();
  });
});

describe("PATCH /api/deliverables/[id] — máquina de estados (teste obrigatório #2)", () => {
  function mockDeliverableAtual(status: string, overrides: Record<string, unknown> = {}) {
    const updateMock = vi.fn().mockImplementation(({ data }) => ({ id: "d1", status, ...overrides, ...data }));
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({
        deliverable: {
          findUnique: vi.fn().mockResolvedValue({ id: "d1", status, ...overrides }),
          update: updateMock,
        },
      }),
    );
    return updateMock;
  }

  it("401 sem sessão, 403 para client_owner", async () => {
    sessionAs(null);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    expect(
      (await PATCH(jsonRequest({ status: "em_revisao" }), { params: Promise.resolve({ id: "d1" }) })).status,
    ).toBe(401);

    sessionAs(CLIENT_OWNER);
    expect(
      (await PATCH(jsonRequest({ status: "em_revisao" }), { params: Promise.resolve({ id: "d1" }) })).status,
    ).toBe(403);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("400 quando o corpo mistura conteudo e status (as duas operações são exclusivas)", async () => {
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    const res = await PATCH(jsonRequest({ conteudo: "texto", status: "aprovado" }), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(400);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("404 quando o entregável não existe", async () => {
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({ deliverable: { findUnique: vi.fn().mockResolvedValue(null) } }),
    );
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    const res = await PATCH(jsonRequest({ status: "em_revisao" }), { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(404);
  });

  it("rascunho → enviado direto, via API, é rejeitado (409) — o teste obrigatório #2 ao pé da letra", async () => {
    const updateMock = mockDeliverableAtual("rascunho");
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    const res = await PATCH(jsonRequest({ status: "enviado" }), { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rascunho → aprovado direto, pulando em_revisao, também é rejeitado (409)", async () => {
    const updateMock = mockDeliverableAtual("rascunho");
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    const res = await PATCH(jsonRequest({ status: "aprovado" }), { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("em_revisao → enviado direto, pulando aprovado, é rejeitado (409)", async () => {
    const updateMock = mockDeliverableAtual("em_revisao");
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    const res = await PATCH(jsonRequest({ status: "enviado" }), { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("enviado é estágio final — nenhuma transição a partir dele é aceita", async () => {
    const updateMock = mockDeliverableAtual("enviado");
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    const res = await PATCH(jsonRequest({ status: "aprovado" }), { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rascunho → em_revisao: transição sequencial válida, 200", async () => {
    const updateMock = mockDeliverableAtual("rascunho");
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    const res = await PATCH(jsonRequest({ status: "em_revisao" }), { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "d1" }, data: { status: "em_revisao" } });
  });

  it('em_revisao → aprovado: só por ação explícita autenticada (admin/staff, já gate no topo da rota) — 200 e grava tempoManualEstimadoMinutos (spec C1.3.a)', async () => {
    const updateMock = mockDeliverableAtual("em_revisao");
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    const res = await PATCH(jsonRequest({ status: "aprovado", tempoManualEstimadoMinutos: 45 }), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { status: "aprovado", tempoManualEstimadoMinutos: 45 },
    });
  });

  it('aprovado → enviado: única transição que "dispara o envio" (registro manual nesta versão, spec 8.3) — 200', async () => {
    const updateMock = mockDeliverableAtual("aprovado");
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    const res = await PATCH(jsonRequest({ status: "enviado" }), { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "d1" }, data: { status: "enviado" } });
  });

  it("editar conteúdo é permitido em rascunho/em_revisao, e rejeitado (409) depois de aprovado", async () => {
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");

    const updateRascunho = mockDeliverableAtual("rascunho");
    const resRascunho = await PATCH(jsonRequest({ conteudo: "texto editado" }), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(resRascunho.status).toBe(200);
    expect(updateRascunho).toHaveBeenCalledWith({ where: { id: "d1" }, data: { conteudo: "texto editado" } });

    const updateAprovado = mockDeliverableAtual("aprovado");
    const resAprovado = await PATCH(jsonRequest({ conteudo: "tentando mudar depois de aprovado" }), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(resAprovado.status).toBe(409);
    expect(updateAprovado).not.toHaveBeenCalled();
  });
});
