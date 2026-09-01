import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey } from "@/lib/supabase-env";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = getSupabaseAnonKey();

const SUPABASE_FETCH_TIMEOUT_MS = 25_000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  init?.signal?.addEventListener('abort', onExternalAbort, { once: true });

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
    init?.signal?.removeEventListener('abort', onExternalAbort);
  });
}

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      global: {
        fetch: fetchWithTimeout,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};
