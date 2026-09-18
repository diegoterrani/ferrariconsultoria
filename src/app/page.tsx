export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Plataforma Ferrari — esqueleto de infraestrutura</h1>
      <p className="max-w-xl text-sm text-neutral-500">
        Este deploy valida a arquitetura (Next.js + Vercel + Supabase + CI/CD)
        antes da implementação dos módulos B1, B6 e C1. Nenhuma tela de
        produto real ainda. Ver <code>/api/health</code> e o README do
        repositório para o estado atual.
      </p>
    </main>
  );
}
