// AgentOS - NextAuth Configuration
// Supports: Google OAuth, Credentials (email/password), JWT sessions

import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  // Prisma adapter for database persistence
  adapter: PrismaAdapter(db),

  // Authentication providers
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Demo credentials provider — accepts any valid-looking email
        // and auto-creates the user on first login
        if (!credentials?.email) return null;

        const email = credentials.email.toLowerCase().trim();

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return null;

        // Check if user already exists
        const existingUser = await db.user.findUnique({
          where: { email },
        });

        if (existingUser) return existingUser;

        // Auto-create user on first login
        const name = email.split("@")[0];
        const newUser = await db.user.create({
          data: {
            email,
            name,
          },
        });

        return newUser;
      },
    }),
  ],

  // Custom pages — login UI is on the main page
  pages: {
    signIn: "/",
  },

  // JWT strategy for Cloudflare compatibility
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // JWT callbacks — include user id and role in token
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in — attach user info to token
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      // Handle session update (e.g., when user updates their profile)
      if (trigger === "update" && session) {
        token.name = session.name;
        token.email = session.email;
        token.picture = session.image;
        if (session.role) token.role = session.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },

  // Secret for JWT signing
  secret:
    process.env.NEXTAUTH_SECRET ??
    "agentos-dev-secret-change-in-production-2024",
};

// Type augmentation for session with custom fields
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      role: string;
    };
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
