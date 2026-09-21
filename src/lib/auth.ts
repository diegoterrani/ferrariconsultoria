import bcrypt from "bcryptjs";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import * as z from "zod";

import { withTenantContext } from "@/lib/db";
import type { TenantContext } from "@/lib/db";

/**
 * Autenticação — Auth.js v5 (next-auth beta), provider de credenciais.
 *
 * Escopo desta fatia: só admin/staff autenticam (spec seção 3 — o cliente
 * tem portal próprio, ainda não desenhado; colaborador do cliente nunca é
 * usuário do sistema). `role` e `tenantId` vêm exclusivamente da consulta ao
 * banco durante o `authorize`, nunca de um campo enviado pelo formulário —
 * é o mesmo princípio da seção 4 aplicado à sessão: o cliente nunca decide
 * seu próprio papel de acesso.
 *
 * Estratégia de sessão: JWT (não sessão em banco) — o app não tem tabela de
 * sessão e o volume de usuários (1-3 pessoas da consultoria no MVP) não
 * justifica esse custo agora. O JWT carrega só o mínimo (id, role,
 * tenantId), nunca o hash de senha.
 */

const CredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: TenantContext["role"];
      tenantId: string | null;
    } & DefaultSession["user"];
  }
  interface User {
    role: TenantContext["role"];
    tenantId: string | null;
  }
}

// Augmenta o módulo de origem (@auth/core/jwt), não o re-export
// "next-auth/jwt": sob moduleResolution "bundler", a resolução de
// `declare module` para um subpath que só re-exporta (sem declaração
// própria) falha com "module cannot be found", mesmo com o import normal
// do mesmo subpath funcionando — quirk conhecido do TypeScript, não erro
// de configuração deste projeto.
declare module "@auth/core/jwt" {
  interface JWT {
    role?: TenantContext["role"];
    tenantId?: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = CredentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Reusa withTenantContext (src/lib/db.ts) com role "admin" pontual:
        // não existe tenant/role de sessão ainda neste ponto — é o próprio
        // login que vai produzi-los, e sem `app.current_role` setado a RLS
        // de `users` (0002_rls_root_tables.sql) não casa nenhuma linha (o
        // pool do Prisma roda com o mesmo role de banco da aplicação, não é
        // superuser). Seguro porque authorize() só compara o hash de UMA
        // linha buscada por e-mail exato, nunca lista ou vaza dado de
        // outro tenant.
        const user = await withTenantContext({ role: "admin", tenantId: null }, (tx) =>
          tx.user.findUnique({ where: { email } }),
        );

        if (!user) return null;

        const senhaConfere = await bcrypt.compare(password, user.passwordHash);
        if (!senhaConfere) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role as TenantContext["role"],
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    session({ session, token }) {
      if (token.role) session.user.role = token.role;
      session.user.tenantId = token.tenantId ?? null;
      return session;
    },
  },
});
