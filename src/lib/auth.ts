// AgentOS - NextAuth Configuration
// Supports: Google OAuth, Credentials (email/password), JWT sessions
// NOTE: No PrismaAdapter — we manage users manually for JWT compatibility

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  // Authentication providers
  providers: [
    // Google OAuth — only include if credentials are configured
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // Credentials provider — demo mode (any email/password works)
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
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
        } catch (error) {
          console.error("[Auth] Credentials authorize error:", error);
          return null;
        }
      },
    }),
  ],

  // JWT strategy for Cloudflare/Vercel edge compatibility
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // JWT callbacks — include user id and role in token
  callbacks: {
    async signIn({ user, account }) {
      // For Google OAuth, create/link user in database
      if (account?.provider === "google" && user.email) {
        try {
          const existingUser = await db.user.findUnique({
            where: { email: user.email },
          });

          if (!existingUser) {
            // Create new user from Google profile
            await db.user.create({
              data: {
                email: user.email,
                name: user.name || user.email.split("@")[0],
                image: user.image,
                emailVerified: new Date(),
              },
            });
          }
        } catch (error) {
          console.error("[Auth] Google sign-in DB error:", error);
          // Allow sign-in to proceed even if DB write fails
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      // Initial sign in — attach user info to token
      if (user) {
        token.id = user.id;
        token.role = "user";
        token.picture = user.image;
      }

      // Handle session update
      if (trigger === "update" && session) {
        const s = session as Record<string, unknown>;
        if (typeof s.name === "string") token.name = s.name;
        if (typeof s.email === "string") token.email = s.email;
        if (typeof s.image === "string") token.picture = s.image;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || "user";
        session.user.image = token.picture as string | null;
      }
      return session;
    },
  },

  // Secret for JWT signing
  secret:
    process.env.NEXTAUTH_SECRET ||
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
    picture?: string | null;
  }
}
