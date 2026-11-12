import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Platform } from "react-native";
import { resolveNativeApiBaseUrl } from "@/lib/network/endpoints";
import { withRequestDeadline } from "@/lib/network/requestDeadline";

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  // Native also defines window, but it is not a browser Location object.
  // Web uses the same origin; Metro forwards /api during development.
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/`;
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN;

  if (!domain) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  return resolveNativeApiBaseUrl(domain);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...extraHeaders,
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    return withRequestDeadline(async (requestSignal) => {
      const res = await fetch(url.toString(), {
        credentials: "include",
        signal: requestSignal,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      // A malformed response must not masquerade as an empty gallery.
      if (queryKey[0] === "/api/gallery" && !Array.isArray(data)) {
        throw new Error("The gallery returned an invalid response.");
      }
      return data;
    }, { signal });
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
