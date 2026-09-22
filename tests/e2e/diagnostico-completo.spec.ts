import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";

/**
 * Teste obrigatório #4 (especificacao_plataforma_dev.md, seção 9): "do
 * preenchimento do wizard de 3 passos até o download do PDF de resultado,
 * cobrindo o caminho mais usado da plataforma no dia a dia da fundadora."
 *
 * STATUS: implementado de verdade (não é mais `test.fixme`) — passou a
 * poder ser escrito quando o módulo C1 fechou a geração de PDF (spec seção
 * 6.1, `/api/assessments/[id]/relatorio`). Cobre exatamente os 5 passos que
 * o placeholder anterior descrevia:
 *   1. Login (admin/staff — só quem autentica nesta fatia, spec seção 3)
 *   2. Navegar para /assessments/novo e preencher os 3 passos
 *   3. Confirmar "Avançar" desabilitado até os campos obrigatórios do passo
 *   4. Submeter ("Calcular diagnóstico") e chegar em /assessments/[id]/resultado
 *   5. Abrir o modal de preview do PDF e confirmar o download (bytes reais,
 *      assinatura `%PDF-`) — e que "Enviar ao cliente" continua desabilitado
 *      (spec 6.1, sem canal de envio real ainda — ver relatorio-modal.tsx).
 *
 * PRÉ-REQUISITO PARA RODAR (mesmo padrão de `tests/integration/tenant-isolation.test.ts`
 * e do job `e2e` em `.github/workflows/ci.yml`): precisa de `DATABASE_URL`
 * apontando para um Postgres real (o `webServer` deste arquivo builda e
 * sobe a aplicação de verdade). Em CI, isso vem do secret/var
 * `DATABASE_URL_TEST` (um projeto Supabase de staging, nunca produção) — ver
 * o `if:` do job `e2e`. Localmente, exporte `DATABASE_URL` no shell antes de
 * `npm run test:e2e` (mesma exigência de qualquer teste desta suíte que
 * precisa de banco real — não há um loader de `.env.local` separado para o
 * processo do Playwright, nem os outros testes obrigatórios têm um).
 *
 * O usuário admin e o tenant/assessment sintéticos usados aqui são criados
 * em `test.beforeAll` (via `withTenantContext`, o mesmo caminho aprovado de
 * qualquer escrita no banco desta aplicação — nunca uma query direta fora
 * dele) e removidos em `test.afterAll`, mesma disciplina de limpeza aplicada
 * manualmente durante a validação do módulo C1 (nunca deixar dado sintético
 * para trás em produção nem em staging).
 */

const CNPJ_TESTE = "11222333000181"; // mesmo CNPJ válido usado em src/lib/cnpj.test.ts
const RAZAO_SOCIAL_TESTE = "[E2E] Restaurante Teste Playwright";
const EMAIL_ADMIN_TESTE = "e2e-admin@ferrari-consultoria.test";
const SENHA_ADMIN_TESTE = "e2e-teste-nao-usar-em-producao-2026";

const dbDisponivel = Boolean(process.env.DATABASE_URL);

test.describe(() => {
  test.skip(
    !dbDisponivel,
    "Requer DATABASE_URL apontando para um Postgres real (staging) — ver comentário no topo do arquivo.",
  );

  test.beforeAll(async () => {
    const { withTenantContext } = await import("@/lib/db");
    const senhaHash = await bcrypt.hash(SENHA_ADMIN_TESTE, 10);

    await withTenantContext({ role: "admin", tenantId: null }, (tx) =>
      tx.user.upsert({
        where: { email: EMAIL_ADMIN_TESTE },
        create: { email: EMAIL_ADMIN_TESTE, passwordHash: senhaHash, role: "admin", tenantId: null },
        update: { passwordHash: senhaHash },
      }),
    );
  });

  test.afterAll(async () => {
    const { withTenantContext } = await import("@/lib/db");

    await withTenantContext({ role: "admin", tenantId: null }, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { cnpj: CNPJ_TESTE } });
      if (tenant) {
        await tx.assessment.deleteMany({ where: { tenantId: tenant.id } });
        await tx.pipelineLead.deleteMany({ where: { tenantId: tenant.id } });
        await tx.tenant.delete({ where: { id: tenant.id } });
      }
      await tx.user.deleteMany({ where: { email: EMAIL_ADMIN_TESTE } });
    });
  });

  test("wizard de diagnóstico: 3 passos → cálculo do score → download do PDF de resultado", async ({
    page,
  }) => {
    // 1. Login
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(EMAIL_ADMIN_TESTE);
    await page.getByLabel("Senha").fill(SENHA_ADMIN_TESTE);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/assessments\/novo/);

    // 2 e 3. Passo 1 — "Avançar" começa desabilitado (campos obrigatórios vazios)
    const botaoAvancar = page.getByRole("button", { name: "Avançar" });
    await expect(botaoAvancar).toBeDisabled();

    await page.getByLabel("Razão social").fill(RAZAO_SOCIAL_TESTE);
    await page.getByLabel("CNPJ").fill(CNPJ_TESTE);
    await page.getByLabel("Porte").selectOption({ label: "Pequeno" });
    await page.getByLabel("Número de colaboradores").fill("40");
    await page.getByPlaceholder("Unidade 1").fill("Unidade Centro");
    await page.getByRole("radio", { name: "Restaurante" }).check();

    await expect(botaoAvancar).toBeEnabled();
    await botaoAvancar.click();

    // Passo 2 — Mapeamento de dores
    await expect(page.getByText("2. Mapeamento de dores")).toBeVisible();
    await page
      .locator("label", { hasText: "Rotatividade percebida" })
      .getByRole("radio", { name: "3", exact: true })
      .check();
    await page
      .locator("label", { hasText: "Histórico de fiscalização ou processo trabalhista" })
      .getByRole("radio", { name: "Não" })
      .check();
    await page
      .locator("label", { hasText: "RH formalizado hoje" })
      .getByRole("radio", { name: "Sim" })
      .check();
    await page.getByRole("button", { name: "Avançar" }).click();

    // Passo 3 — Jornada e escala
    await expect(page.getByText("3. Jornada e escala")).toBeVisible();
    const botaoCalcular = page.getByRole("button", { name: "Calcular diagnóstico" });
    await expect(botaoCalcular).toBeDisabled();

    await page.getByLabel("Regime").selectOption({ label: "6x1" });
    await page
      .locator("label", { hasText: "Gestão de gorjetas" })
      .getByRole("radio", { name: "Rateio formal" })
      .check();
    await page
      .locator("label", { hasText: "Banco de horas" })
      .getByRole("radio", { name: "Sim" })
      .check();

    await expect(botaoCalcular).toBeEnabled();
    await botaoCalcular.click();

    // 4. Resultado
    await expect(page).toHaveURL(/\/assessments\/[^/]+\/resultado/);
    await expect(page.getByRole("heading", { name: "Resultado do diagnóstico" })).toBeVisible();

    // 5. Preview + download do PDF
    await page.getByRole("button", { name: "Gerar relatório em PDF" }).click();
    const dialogo = page.getByRole("dialog", { name: "Relatório de resultado — preview" });
    await expect(dialogo).toBeVisible();

    // "Enviar ao cliente" honestamente desabilitado — ver racional em
    // src/app/api/assessments/[id]/relatorio/route.ts.
    await expect(dialogo.getByRole("button", { name: "Enviar ao cliente" })).toBeDisabled();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      dialogo.getByRole("link", { name: "Baixar" }).click(),
    ]);

    expect(download.suggestedFilename()).toBe(`diagnostico-${CNPJ_TESTE}.pdf`);
    const caminho = await download.path();
    expect(caminho).not.toBeNull();
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(caminho!);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
