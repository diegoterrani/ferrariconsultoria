import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes de integração das rotas de API do módulo B1 (wizard de
 * diagnóstico) — complementam, sem substituir, o teste obrigatório #1
 * (tenant-isolation.test.ts, spec seção 9), que verifica a policy RLS
 * contra um Postgres real.
 *
 * STATUS HONESTO — o que este arquivo cobre e o que não cobre:
 *
 * COBRE (roda sem banco real, `@/lib/auth` e `@/lib/db` são mockados):
 *   - as 4 rotas nunca chamam `withTenantContext` (logo, nunca tocam o
 *     banco) antes de checar sessão e papel — o 401/403 é a primeira coisa
 *     que acontece, sempre;
 *   - o contexto de tenant passado para `withTenantContext` vem SEMPRE da
 *     sessão (`session.user.role`/`session.user.tenantId`), nunca do corpo
 *     da requisição — mesmo quando o corpo tenta enviar um `tenantId`
 *     (os schemas Zod nem aceitam esse campo, então ele é descartado antes
 *     de chegar perto do contexto);
 *   - validação Zod (400/422) e os ramos 404 de cada rota.
 *
 * NÃO COBRE (e não finge cobrir): se a policy RLS do Postgres realmente
 * barra um `tenantId` de sessão diferente do dono da linha — isso só um
 * banco real responde, e é exatamente o escopo de
 * tenant-isolation.test.ts (pulado até `DATABASE_URL_TEST` existir). Os
 * dois arquivos são complementares: este garante que a aplicação SEMPRE
 * pede pro banco aplicar a regra com o contexto certo; aquele garante que
 * o banco de fato aplica.
 */

type SessionUser = { role: "admin" | "staff" | "client_owner"; tenantId: string | null };

const authMock = vi.fn<(...args: unknown[]) => Promise<{ user: SessionUser } | null>>();
const withTenantContextMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ withTenantContext: withTenantContextMock }));

function sessionAs(user: SessionUser | null) {
  authMock.mockResolvedValue(user ? { user } : null);
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
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

describe("POST /api/assessments (criação — passo 1 do wizard)", () => {
  it("401 sem sessão, e nunca chega a tocar o banco", async () => {
    sessionAs(null);
    const { POST } = await import("@/app/api/assessments/route");

    const res = await POST(jsonRequest({}));

    expect(res.status).toBe(401);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("403 para role client_owner, e nunca chega a tocar o banco", async () => {
    sessionAs(CLIENT_OWNER);
    const { POST } = await import("@/app/api/assessments/route");

    const res = await POST(jsonRequest({}));

    expect(res.status).toBe(403);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("400 para corpo inválido (CNPJ com dígito verificador errado)", async () => {
    sessionAs(ADMIN);
    const { POST } = await import("@/app/api/assessments/route");

    const res = await POST(
      jsonRequest({
        razaoSocial: "Empresa Teste",
        cnpj: "11111111111111",
        porte: "pequeno",
        numColaboradores: 5,
        unidades: ["Matriz"],
        segmento: "restaurante",
      }),
    );

    expect(res.status).toBe(400);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("201 com corpo válido, e o contexto de tenant vem da sessão — nunca do corpo", async () => {
    sessionAs(ADMIN);
    withTenantContextMock.mockImplementation(async (ctx, fn) =>
      fn({
        tenant: { upsert: vi.fn().mockResolvedValue({ id: "tenant-novo" }) },
        assessment: {
          create: vi.fn().mockResolvedValue({ id: "assessment-novo", tenantId: "tenant-novo" }),
        },
      }),
    );
    const { POST } = await import("@/app/api/assessments/route");

    // CNPJ válido (dígitos verificadores corretos) — Ferrari Consultoria de teste.
    const res = await POST(
      jsonRequest({
        razaoSocial: "Empresa Teste",
        cnpj: "11.222.333/0001-81",
        porte: "pequeno",
        numColaboradores: 5,
        unidades: ["Matriz"],
        segmento: "restaurante",
        tenantId: "tenant-b-tentativa-de-injecao", // não existe no schema — deve ser ignorado
      }),
    );

    expect(res.status).toBe(201);
    expect(withTenantContextMock).toHaveBeenCalledTimes(1);
    const ctxRecebido = withTenantContextMock.mock.calls[0][0];
    expect(ctxRecebido).toEqual({ role: "admin", tenantId: null }); // veio de ADMIN, não do body
  });
});

describe("GET /api/assessments/[id]", () => {
  it("401 sem sessão", async () => {
    sessionAs(null);
    const { GET } = await import("@/app/api/assessments/[id]/route");

    const res = await GET(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(res.status).toBe(401);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("404 quando withTenantContext não encontra o assessment (RLS ou inexistência)", async () => {
    sessionAs(CLIENT_OWNER);
    withTenantContextMock.mockResolvedValue(null);
    const { GET } = await import("@/app/api/assessments/[id]/route");

    const res = await GET(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(res.status).toBe(404);
  });

  it("200 e propaga o tenantId da sessão para o contexto de RLS", async () => {
    sessionAs(CLIENT_OWNER);
    withTenantContextMock.mockResolvedValue({ id: "abc", tenantId: "tenant-a" });
    const { GET } = await import("@/app/api/assessments/[id]/route");

    const res = await GET(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(res.status).toBe(200);
    const ctxRecebido = withTenantContextMock.mock.calls[0][0];
    expect(ctxRecebido).toEqual({ role: "client_owner", tenantId: "tenant-a" });
  });
});

describe("PATCH /api/assessments/[id] (autosave passos 2 e 3)", () => {
  it("401 sem sessão", async () => {
    sessionAs(null);
    const { PATCH } = await import("@/app/api/assessments/[id]/route");

    const res = await PATCH(jsonRequest({}), { params: Promise.resolve({ id: "abc" }) });

    expect(res.status).toBe(401);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("403 para role client_owner", async () => {
    sessionAs(CLIENT_OWNER);
    const { PATCH } = await import("@/app/api/assessments/[id]/route");

    const res = await PATCH(jsonRequest({}), { params: Promise.resolve({ id: "abc" }) });

    expect(res.status).toBe(403);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("400 para corpo fora do schema (step2 com rotatividadePercebida > 5)", async () => {
    sessionAs(ADMIN);
    const { PATCH } = await import("@/app/api/assessments/[id]/route");

    const res = await PATCH(
      jsonRequest({ step2: { rotatividadePercebida: 9, historicoFiscalizacao: false, rhFormalizado: true } }),
      { params: Promise.resolve({ id: "abc" }) },
    );

    expect(res.status).toBe(400);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("404 quando o assessment não existe no tenant da sessão", async () => {
    sessionAs(ADMIN);
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({ assessment: { findUnique: vi.fn().mockResolvedValue(null) } }),
    );
    const { PATCH } = await import("@/app/api/assessments/[id]/route");

    const res = await PATCH(
      jsonRequest({ step2: { rotatividadePercebida: 3, historicoFiscalizacao: false, rhFormalizado: true } }),
      { params: Promise.resolve({ id: "abc" }) },
    );

    expect(res.status).toBe(404);
  });

  it("200 faz merge raso — mantém step1 já salvo ao gravar step2", async () => {
    sessionAs(ADMIN);
    const updateMock = vi.fn().mockImplementation(({ data }) => ({ id: "abc", ...data }));
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({
        assessment: {
          findUnique: vi.fn().mockResolvedValue({
            respostas: { step1: { razaoSocial: "Empresa Teste" } },
          }),
          update: updateMock,
        },
      }),
    );
    const { PATCH } = await import("@/app/api/assessments/[id]/route");

    const res = await PATCH(
      jsonRequest({ step2: { rotatividadePercebida: 3, historicoFiscalizacao: false, rhFormalizado: true } }),
      { params: Promise.resolve({ id: "abc" }) },
    );

    expect(res.status).toBe(200);
    const respostasGravadas = updateMock.mock.calls[0][0].data.respostas;
    expect(respostasGravadas.step1).toEqual({ razaoSocial: "Empresa Teste" }); // não foi perdido
    expect(respostasGravadas.step2.rotatividadePercebida).toBe(3);
  });
});

describe("POST /api/assessments/[id]/submit (cálculo do score)", () => {
  const respostasCompletas = {
    step1: {
      razaoSocial: "Empresa Teste",
      cnpj: "11.222.333/0001-81",
      porte: "pequeno" as const,
      numColaboradores: 5,
      unidades: ["Matriz"],
      segmento: "restaurante" as const,
    },
    step2: {
      rotatividadePercebida: 3,
      historicoFiscalizacao: false,
      rhFormalizado: true,
    },
  };

  it("401 sem sessão", async () => {
    sessionAs(null);
    const { POST } = await import("@/app/api/assessments/[id]/submit/route");

    const res = await POST(jsonRequest({}), { params: Promise.resolve({ id: "abc" }) });

    expect(res.status).toBe(401);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("422 quando passos anteriores do wizard estão incompletos", async () => {
    sessionAs(ADMIN);
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({
        assessment: {
          findUnique: vi.fn().mockResolvedValue({ respostas: { step1: respostasCompletas.step1 } }), // falta step2
        },
      }),
    );
    const { POST } = await import("@/app/api/assessments/[id]/submit/route");

    const res = await POST(
      jsonRequest({
        step3: { regime: "12x36", gestaoGorjetas: "formal", bancoDeHoras: false },
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );

    expect(res.status).toBe(422);
  });

  it("200 calcula o score determinístico quando o wizard está completo", async () => {
    sessionAs(ADMIN);
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({
        assessment: {
          findUnique: vi.fn().mockResolvedValue({ respostas: respostasCompletas }),
          update: vi.fn().mockImplementation(({ data }) => ({ id: "abc", ...data })),
        },
      }),
    );
    const { POST } = await import("@/app/api/assessments/[id]/submit/route");

    const res = await POST(
      jsonRequest({
        step3: { regime: "12x36", gestaoGorjetas: "formal", bancoDeHoras: false },
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(typeof corpo.scoreExposicao).toBe("number");
    expect(corpo.scoreExposicao).toBeGreaterThanOrEqual(0);
    expect(corpo.scoreExposicao).toBeLessThanOrEqual(100);
  });
});

describe("POST /api/pipeline-leads (registrar decisão do cliente)", () => {
  it("401 sem sessão", async () => {
    sessionAs(null);
    const { POST } = await import("@/app/api/pipeline-leads/route");

    const res = await POST(jsonRequest({}));

    expect(res.status).toBe(401);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("400 para decisão fora do enum aceito", async () => {
    sessionAs(ADMIN);
    const { POST } = await import("@/app/api/pipeline-leads/route");

    const res = await POST(
      jsonRequest({ assessmentId: "00000000-0000-0000-0000-000000000000", decisao: "talvez" }),
    );

    expect(res.status).toBe(400);
    expect(withTenantContextMock).not.toHaveBeenCalled();
  });

  it("estagio é derivado da decisão pelo servidor, nunca aceito do corpo (aceite → fechamento)", async () => {
    sessionAs(ADMIN);
    const createMock = vi.fn().mockImplementation(({ data }) => ({ id: "lead-1", ...data }));
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({
        assessment: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant-a" }) },
        pipelineLead: { findFirst: vi.fn().mockResolvedValue(null), create: createMock },
      }),
    );
    const { POST } = await import("@/app/api/pipeline-leads/route");

    const res = await POST(
      jsonRequest({
        assessmentId: "00000000-0000-0000-0000-000000000000",
        decisao: "aceite",
        estagio: "fechamento-forcado-pelo-cliente", // não existe no schema — deve ser ignorado
      }),
    );

    expect(res.status).toBe(201);
    expect(createMock.mock.calls[0][0].data.estagio).toBe("fechamento");
  });

  it("decisao 'recusa' deriva estagio 'diagnostico', não 'fechamento'", async () => {
    sessionAs(ADMIN);
    const createMock = vi.fn().mockImplementation(({ data }) => ({ id: "lead-1", ...data }));
    withTenantContextMock.mockImplementation(async (_ctx, fn) =>
      fn({
        assessment: { findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant-a" }) },
        pipelineLead: { findFirst: vi.fn().mockResolvedValue(null), create: createMock },
      }),
    );
    const { POST } = await import("@/app/api/pipeline-leads/route");

    const res = await POST(
      jsonRequest({ assessmentId: "00000000-0000-0000-0000-000000000000", decisao: "recusa" }),
    );

    expect(res.status).toBe(201);
    expect(createMock.mock.calls[0][0].data.estagio).toBe("diagnostico");
  });
});
