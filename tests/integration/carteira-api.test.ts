import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes de integração das rotas de API do módulo B6 (Gestão de carteira) —
 * mesmo padrão e mesmo status honesto de tests/integration/assessments-api.test.ts:
 * `@/lib/auth` e `@/lib/db` mockados, sem precisar de banco real. Cobre
 * 401/403 sempre antes de tocar o banco, validação Zod, e as duas decisões
 * de implementação desta fase que não estão na spec ao pé da letra —
 * `pacoteContratado` só é gravado no aceite (POST /api/pipeline-leads) e
 * `gerar-mes` é idempotente por competência — porque são exatamente os
 * pontos onde um bug seria silencioso (cobrar em dobro, ou nunca popular
 * o pacote de um cliente).
 */

type SessionUser = { role: "admin" | "staff" | "client_owner"; tenantId: string | null };

const authMock = vi.fn<(...args: unknown[]) => Promise<{ user: SessionUser } | null>>();
const withTenantContextMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ withTenantContext: withTenantContextMock }));

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

beforeEach(() => {
  authMock.mockReset();
  withTenantContextMock.mockReset();
});

describe("POST /api/time-entries", () => {
  it("401 sem sessão, 403 para client_owner — nenhum toca o banco", async () => {
    sessionAs(null);
    const { POST } = await import("@/app/api/time-entries/route");
    expect((await POST(jsonRequest({}))).status).toBe(401);
    expect(withTenantContextMock).not.toHaveBeenCalled();

    sessionAs(CLIENT_OWNER);
    expect((await POST(jsonRequest({}))).status).toBe(403);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("400 para duração zerada implícita não é validada aqui (zod só valida faixa) — mas horas/minutos fora da faixa são 400", async () => {
    sessionAs(ADMIN);
    const { POST } = await import("@/app/api/time-entries/route");
    const res = await POST(
      jsonRequest({ tenantId: "00000000-0000-0000-0000-000000000000", atividade: "entrega", horas: 30, minutos: 0, data: "2026-09-21" }),
    );
    expect(res.status).toBe(400);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("404 quando o tenant não existe", async () => {
    sessionAs(ADMIN);
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({ tenant: { findUnique: vi.fn().mockResolvedValue(null) } }),
    );
    const { POST } = await import("@/app/api/time-entries/route");
    const res = await POST(
      jsonRequest({ tenantId: "00000000-0000-0000-0000-000000000000", atividade: "entrega", horas: 1, minutos: 30, data: "2026-09-21" }),
    );
    expect(res.status).toBe(404);
  });

  it("201 e duracaoMinutos = horas*60 + minutos, contexto vem da sessão", async () => {
    sessionAs(ADMIN);
    const createMock = vi.fn().mockImplementation(({ data }) => ({ id: "te-1", ...data }));
    withTenantContextMock.mockImplementation(async (ctx, fn) => {
      expect(ctx).toEqual({ role: "admin", tenantId: null });
      return fn({
        tenant: { findUnique: vi.fn().mockResolvedValue({ id: "tenant-x" }) },
        timeEntry: { create: createMock },
      });
    });
    const { POST } = await import("@/app/api/time-entries/route");
    const res = await POST(
      jsonRequest({ tenantId: "00000000-0000-0000-0000-000000000000", atividade: "prospeccao", horas: 1, minutos: 30, data: "2026-09-21" }),
    );
    expect(res.status).toBe(201);
    expect(createMock.mock.calls[0][0].data.duracaoMinutos).toBe(90);
  });
});

describe("PATCH /api/tenants/[id]", () => {
  it("401/403 antes de tocar o banco", async () => {
    sessionAs(null);
    const { PATCH } = await import("@/app/api/tenants/[id]/route");
    expect((await PATCH(jsonRequest({}), { params: Promise.resolve({ id: "t1" }) })).status).toBe(401);

    sessionAs(CLIENT_OWNER);
    expect((await PATCH(jsonRequest({}), { params: Promise.resolve({ id: "t1" }) })).status).toBe(403);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("400 para pacote fora do enum", async () => {
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/tenants/[id]/route");
    const res = await PATCH(jsonRequest({ pacoteContratado: "Enterprise" }), {
      params: Promise.resolve({ id: "t1" }),
    });
    expect(res.status).toBe(400);
  });

  it("404 quando o tenant não existe", async () => {
    sessionAs(ADMIN);
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({ tenant: { findUnique: vi.fn().mockResolvedValue(null) } }),
    );
    const { PATCH } = await import("@/app/api/tenants/[id]/route");
    const res = await PATCH(jsonRequest({ status: "risco_churn" }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(404);
  });

  it("200 e atualiza só os campos enviados", async () => {
    sessionAs(ADMIN);
    const updateMock = vi.fn().mockImplementation(({ data }) => ({ id: "t1", ...data }));
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({ tenant: { findUnique: vi.fn().mockResolvedValue({ id: "t1" }), update: updateMock } }),
    );
    const { PATCH } = await import("@/app/api/tenants/[id]/route");
    const res = await PATCH(jsonRequest({ status: "risco_churn" }), { params: Promise.resolve({ id: "t1" }) });
    expect(res.status).toBe(200);
    expect(updateMock.mock.calls[0][0].data).toEqual({ status: "risco_churn" });
  });
});

describe("GET/PATCH /api/capacity-settings", () => {
  it("401/403 no GET e no PATCH", async () => {
    sessionAs(null);
    const { GET, PATCH } = await import("@/app/api/capacity-settings/route");
    expect((await GET()).status).toBe(401);
    expect((await PATCH(jsonRequest({ horasPorSemana: 20 }))).status).toBe(401);

    sessionAs(CLIENT_OWNER);
    expect((await GET()).status).toBe(403);
    expect((await PATCH(jsonRequest({ horasPorSemana: 20 }))).status).toBe(403);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("400 para valor fora da faixa (0 ou > 168h/semana)", async () => {
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/capacity-settings/route");
    expect((await PATCH(jsonRequest({ horasPorSemana: 0 }))).status).toBe(400);
    expect((await PATCH(jsonRequest({ horasPorSemana: 200 }))).status).toBe(400);
  });

  it("PATCH faz upsert com id fixo 'default'", async () => {
    sessionAs(ADMIN);
    const upsertMock = vi.fn().mockImplementation(({ update }) => ({ id: "default", ...update }));
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({ capacitySettings: { upsert: upsertMock } }),
    );
    const { PATCH } = await import("@/app/api/capacity-settings/route");
    const res = await PATCH(jsonRequest({ horasPorSemana: 25 }));
    expect(res.status).toBe(200);
    expect(upsertMock.mock.calls[0][0].where).toEqual({ id: "default" });
    expect(upsertMock.mock.calls[0][0].update.horasPorSemana).toBe(25);
  });
});

describe("PATCH /api/pipeline-leads/[id] (mover card no Kanban)", () => {
  it("401/403 antes de tocar o banco", async () => {
    sessionAs(null);
    const { PATCH } = await import("@/app/api/pipeline-leads/[id]/route");
    expect((await PATCH(jsonRequest({ estagio: "reuniao" }), { params: Promise.resolve({ id: "l1" }) })).status).toBe(401);

    sessionAs(CLIENT_OWNER);
    expect((await PATCH(jsonRequest({ estagio: "reuniao" }), { params: Promise.resolve({ id: "l1" }) })).status).toBe(403);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("400 para estagio fora do enum (não deixa inventar coluna nova)", async () => {
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/pipeline-leads/[id]/route");
    const res = await PATCH(jsonRequest({ estagio: "ganho" }), { params: Promise.resolve({ id: "l1" }) });
    expect(res.status).toBe(400);
  });

  it("404 quando o lead não existe", async () => {
    sessionAs(ADMIN);
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({ pipelineLead: { findUnique: vi.fn().mockResolvedValue(null) } }),
    );
    const { PATCH } = await import("@/app/api/pipeline-leads/[id]/route");
    const res = await PATCH(jsonRequest({ estagio: "reuniao" }), { params: Promise.resolve({ id: "l1" }) });
    expect(res.status).toBe(404);
  });

  it("200 e não aceita decisao/motivoDecisao no corpo (só estagio existe no schema)", async () => {
    sessionAs(ADMIN);
    const updateMock = vi.fn().mockImplementation(({ data }) => ({ id: "l1", ...data }));
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({ pipelineLead: { findUnique: vi.fn().mockResolvedValue({ id: "l1" }), update: updateMock } }),
    );
    const { PATCH } = await import("@/app/api/pipeline-leads/[id]/route");
    const res = await PATCH(
      jsonRequest({ estagio: "fechamento", decisao: "aceite" }), // decisao tentando entrar por aqui
      { params: Promise.resolve({ id: "l1" }) },
    );
    expect(res.status).toBe(200);
    expect(updateMock.mock.calls[0][0].data).toEqual({ estagio: "fechamento" }); // decisao ignorada
  });
});

describe("POST /api/pipeline-leads — ponte com tenants.pacoteContratado no aceite", () => {
  it("aceite com pacoteSugerido válido grava tenant.pacoteContratado", async () => {
    sessionAs(ADMIN);
    const tenantUpdateMock = vi.fn().mockResolvedValue({});
    const leadCreateMock = vi.fn().mockImplementation(({ data }) => ({ id: "lead-1", ...data }));
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({
        assessment: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant-a" }) },
        pipelineLead: { findFirst: vi.fn().mockResolvedValue(null), create: leadCreateMock },
        tenant: { update: tenantUpdateMock },
      }),
    );
    const { POST } = await import("@/app/api/pipeline-leads/route");
    const res = await POST(
      jsonRequest({
        assessmentId: "00000000-0000-0000-0000-000000000000",
        decisao: "aceite",
        pacoteSugerido: "Premium",
      }),
    );
    expect(res.status).toBe(201);
    expect(tenantUpdateMock).toHaveBeenCalledWith({
      where: { id: "tenant-a" },
      data: { pacoteContratado: "Premium" },
    });
  });

  it("recusa NUNCA grava pacoteContratado, mesmo com pacoteSugerido presente no corpo", async () => {
    sessionAs(ADMIN);
    const tenantUpdateMock = vi.fn();
    const leadCreateMock = vi.fn().mockImplementation(({ data }) => ({ id: "lead-1", ...data }));
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({
        assessment: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant-a" }) },
        pipelineLead: { findFirst: vi.fn().mockResolvedValue(null), create: leadCreateMock },
        tenant: { update: tenantUpdateMock },
      }),
    );
    const { POST } = await import("@/app/api/pipeline-leads/route");
    const res = await POST(
      jsonRequest({
        assessmentId: "00000000-0000-0000-0000-000000000000",
        decisao: "recusa",
        pacoteSugerido: "Premium",
      }),
    );
    expect(res.status).toBe(201);
    expect(tenantUpdateMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/invoices/preview-mes", () => {
  it("401/403 antes de tocar o banco", async () => {
    sessionAs(null);
    const { GET } = await import("@/app/api/invoices/preview-mes/route");
    expect((await GET()).status).toBe(401);

    sessionAs(CLIENT_OWNER);
    expect((await GET()).status).toBe(403);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("só conta tenants ativos, com pacote válido, sem fatura na competência atual", async () => {
    sessionAs(ADMIN);
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({
        tenant: {
          findMany: vi.fn().mockResolvedValue([
            { id: "t1", razaoSocial: "A", pacoteContratado: "Básico" }, // elegível
            { id: "t2", razaoSocial: "B", pacoteContratado: null }, // sem pacote — fora
            { id: "t3", razaoSocial: "C", pacoteContratado: "Premium" }, // já tem fatura — fora
          ]),
        },
        invoice: { findMany: vi.fn().mockResolvedValue([{ tenantId: "t3" }]) },
      }),
    );
    const { GET } = await import("@/app/api/invoices/preview-mes/route");
    const res = await GET();
    const corpo = await res.json();
    expect(corpo.count).toBe(1);
    expect(corpo.tenants[0].id).toBe("t1");
    expect(corpo.tenants[0].valor).toBe(2800); // preço do Básico
  });
});

describe("POST /api/invoices/gerar-mes", () => {
  it("401/403 antes de tocar o banco", async () => {
    sessionAs(null);
    const { POST } = await import("@/app/api/invoices/gerar-mes/route");
    expect((await POST()).status).toBe(401);

    sessionAs(CLIENT_OWNER);
    expect((await POST()).status).toBe(403);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("cria só pros tenants elegíveis, idempotente (pula quem já tem fatura na competência)", async () => {
    sessionAs(ADMIN);
    const createMock = vi.fn().mockImplementation(({ data }) => ({ id: `inv-${data.tenantId}`, ...data }));
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({
        tenant: {
          findMany: vi.fn().mockResolvedValue([
            { id: "t1", pacoteContratado: "Básico" },
            { id: "t2", pacoteContratado: "Premium" },
          ]),
        },
        invoice: {
          findMany: vi.fn().mockResolvedValue([{ tenantId: "t2" }]), // t2 já faturado
          create: createMock,
        },
      }),
    );
    const { POST } = await import("@/app/api/invoices/gerar-mes/route");
    const res = await POST();
    const corpo = await res.json();
    expect(res.status).toBe(201);
    expect(corpo.criadas).toHaveLength(1);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0].data).toMatchObject({ tenantId: "t1", valor: 2800, status: "pendente" });
  });
});

describe("PATCH /api/invoices/[id]", () => {
  it("401/403/400/404", async () => {
    sessionAs(null);
    const { PATCH } = await import("@/app/api/invoices/[id]/route");
    expect((await PATCH(jsonRequest({ status: "pago" }), { params: Promise.resolve({ id: "i1" }) })).status).toBe(401);

    sessionAs(CLIENT_OWNER);
    expect((await PATCH(jsonRequest({ status: "pago" }), { params: Promise.resolve({ id: "i1" }) })).status).toBe(403);
    expect(withTenantContextMock).not.toHaveBeenCalled();

    sessionAs(ADMIN);
    expect((await PATCH(jsonRequest({ status: "cancelado" }), { params: Promise.resolve({ id: "i1" }) })).status).toBe(400);

    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({ invoice: { findUnique: vi.fn().mockResolvedValue(null) } }),
    );
    expect((await PATCH(jsonRequest({ status: "pago" }), { params: Promise.resolve({ id: "i1" }) })).status).toBe(404);
  });

  it("200 e atualiza o status", async () => {
    sessionAs(ADMIN);
    const updateMock = vi.fn().mockImplementation(({ data }) => ({ id: "i1", ...data }));
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({ invoice: { findUnique: vi.fn().mockResolvedValue({ id: "i1" }), update: updateMock } }),
    );
    const { PATCH } = await import("@/app/api/invoices/[id]/route");
    const res = await PATCH(jsonRequest({ status: "pago" }), { params: Promise.resolve({ id: "i1" }) });
    expect(res.status).toBe(200);
    expect(updateMock.mock.calls[0][0].data).toEqual({ status: "pago" });
  });
});
