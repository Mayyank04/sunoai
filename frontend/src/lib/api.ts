const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

// Storage URLs returned by the API must follow an explicitly configured API origin.
export function resolveMediaUrl(url: string): string {
  if (url.startsWith("/api/v1/") && /^https?:\/\//i.test(API_BASE)) {
    return new URL(url, API_BASE).href;
  }
  return url;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("fombo_token") : null;

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> || {}),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode: string | undefined;
    try {
      const errorJson = await response.json();
      const detail = errorJson.detail ?? errorJson;
      errorCode = detail?.error_code;
      if (typeof detail === "string") errorDetail = detail;
      else if (Array.isArray(detail)) errorDetail = detail.map((item) => item.msg || JSON.stringify(item)).join("; ");
      else errorDetail = detail.message || detail.error || JSON.stringify(detail);
    } catch {
      // Non-JSON error body
    }
    throw new ApiError(errorDetail, response.status, errorCode);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
