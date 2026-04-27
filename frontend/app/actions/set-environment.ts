"use server";

import { cookies, headers } from "next/headers";
import { getCookieDomain } from "@/lib/utils";

export type EnvironmentType = "HR" | "ERP" | "POS" | "ADMIN" | "MASTER";

export async function setEnvironmentCookie(env: EnvironmentType) {
  const cookieStore = await cookies();

  // We need the request headers to determine the domain
  // In server actions, we don't have direct access to the request object easily
  // but we can try to set the cookie without domain first (host only)
  // or rely on the client to pass domain info if needed.
  // However, `cookies().set` in server action works for the current domain.

  // To share across subdomains, we need to explicitly set the domain.
  // Since we can't easily get the hostname in a server action without passing it,
  // we'll rely on a best-effort approach or require the domain to be passed?
  // Actually, let's try to do it cleanly.

  // Ideally, we want to set it on the base domain.
  // Since we are running this on the server, we can't access `window`.
  // But we can just set it on the current domain and let the client side handling remain
  // OR we can try to be smart about it.

  // Let's stick to setting it with specific options that `cookies().set` allows.
  // Note: Next.js cookies() API handles the response header setting.

  // IMPORTANT: For true cross-subdomain support, we really want to set the domain attribute.
  // But hardcoding it is brittle.
  // A common pattern is to just set it on the client side for cross-subdomain (like we did in the provider).
  // But the user requested a server action.

  // If we want to do it purely server-side, we might need the host from headers.
  // We can't get headers directly in a standalone server action easily unless we use `headers()`.

  const { headers } = await import("next/headers");
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const domain = getCookieDomain(host);

  cookieStore.set("app-environment", env, {
    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    path: "/",
    domain: domain,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  return { success: true, env };
}
