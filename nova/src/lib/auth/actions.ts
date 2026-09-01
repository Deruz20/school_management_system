"use server";

import { z } from "zod";
import { db } from "../db";
import { verifyPassword } from "./password";
import { createSession, setSessionCookie, deleteSessionCookie, invalidateSession, validateSession } from "./session";
import { redirect } from "next/navigation";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export async function loginAction(prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const result = loginSchema.safeParse({ email, password });
  if (!result.success) {
    return { error: "Invalid input." };
  }

  const user = await db.user.findUnique({
    where: { email: result.data.email },
  });

  if (!user || user.status !== "ACTIVE") {
    return { error: "Invalid credentials or account suspended." };
  }

  const isValidPassword = await verifyPassword(result.data.password, user.passwordHash);
  if (!isValidPassword) {
    return { error: "Invalid credentials." };
  }

  // Generate secure session
  const { id, expiresAt } = await createSession(user.id);
  await setSessionCookie(id, expiresAt);

  // Audit Log
  await db.auditLog.create({
    data: {
      action: "LOGIN",
      userId: user.id,
      organizationId: user.organizationId,
      details: "User logged in successfully via email.",
    }
  });

  redirect("/");
}

export async function logoutAction() {
  const { session } = await validateSession();
  if (session) {
    await invalidateSession(session.id);
    
    // Audit Log
    await db.auditLog.create({
      data: {
        action: "LOGOUT",
        userId: session.userId,
        details: "User explicitly logged out.",
      }
    });
  }
  await deleteSessionCookie();
  redirect("/login");
}
