// AgentOS - NextAuth API Route Handler

import { authOptions } from "@/lib/auth";
import NextAuth from "next-auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

export const runtime = "nodejs";
