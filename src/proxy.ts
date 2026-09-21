import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Proxy (Next.js 16 renomeou `middleware.ts` → `proxy.ts` — só o nome do
 * arquivo/export mudou, o comportamento é o mesmo; ver
 * node_modules/next/dist/docs/.../proxy.md, seção "Migration to Proxy").
 *
 * Checagem otimista de sessão (JWT via cookie), redireciona não-autenticado
 * para /login. Não é a única linha de defesa: cada rota de API valida a
 * sessão de novo antes de tocar o banco (spec seção 4 — nunca confiar só em
 * uma checagem central), o Proxy só evita a viagem completa até a página.
 */
export default auth((req) => {
  const isAuthed = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!isAuthed && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthed && isLoginPage) {
    return NextResponse.redirect(new URL("/assessments/novo", req.nextUrl));
  }
});

export const config = {
  // Protege só as PÁGINAS internas (admin/staff) com redirect. Rotas de API
  // ficam fora do matcher de propósito: um redirect HTML não é uma resposta
  // sensata pra um cliente de API sem sessão — cada rota em src/app/api/**
  // chama `auth()` e retorna 401/403 em JSON por conta própria (padrão
  // documentado em node_modules/next/dist/docs/.../authentication.md,
  // seção "Route Handlers" — dupla checagem é o esperado, não redundância).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
