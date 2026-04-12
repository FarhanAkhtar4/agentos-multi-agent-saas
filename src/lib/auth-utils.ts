// AgentOS - Authentication Utility Functions
// Server-side helpers for session and user management

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Re-export getServerSession with pre-configured authOptions
export const getAuthSession = () => getServerSession(authOptions);

// Get the current authenticated user, or null if not authenticated
export async function getCurrentUser() {
  const session = await getAuthSession();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  return user;
}

// Require authentication — throws an error if not authenticated
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  return user;
}

// Get current session with user role check
export async function requireRole(role: string) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }

  if (session.user.role !== role) {
    throw new Error(`Role '${role}' required`);
  }

  return session.user;
}
