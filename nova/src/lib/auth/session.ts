import { cookies } from "next/headers";
import { db } from "../db";
import { encodeHexLowerCase } from "@oslojs/encoding";

// We'll use the Web Crypto API to generate secure random session IDs.
export function generateSessionId(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeHexLowerCase(bytes);
}

const SESSION_COOKIE_NAME = "nova_session";

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const sessionId = generateSessionId();
  // Session expires in 30 days
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  
  await db.session.create({
    data: {
      id: sessionId, // In a highly secure environment, we could hash this before storing.
      userId,
      expiresAt,
    },
  });
  
  return { id: sessionId, expiresAt };
}

export async function setSessionCookie(sessionId: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function validateSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  
  if (!sessionId) {
    return { session: null, user: null };
  }

  const result = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: {
          branchAccess: {
            include: {
              branch: true,
              role: true
            }
          }
        }
      }
    }
  });

  if (!result) {
    return { session: null, user: null };
  }

  const { user, ...session } = result;
  
  if (Date.now() >= session.expiresAt.getTime()) {
    await db.session.delete({ where: { id: sessionId } });
    return { session: null, user: null };
  }

  // Session extension logic (rolling sessions)
  if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
    session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await db.session.update({
      where: { id: sessionId },
      data: { expiresAt: session.expiresAt }
    });
  }

  return { session, user };
}

export async function invalidateSession(sessionId: string) {
  await db.session.delete({ where: { id: sessionId } });
}
