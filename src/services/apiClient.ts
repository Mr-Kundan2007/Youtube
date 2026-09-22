/**
 * Centralized API Client
 * Enterprise-grade HTTP client with request timeout, abort controller support,
 * authorization header injection, and standardized error normalization.
 */

export interface ApiErrorResponse {
  message: string
  status: number
  code: string
  retryable: boolean
  details?: unknown
}

export class ApiError extends Error {
  public status: number
  public code: string
  public retryable: boolean
  public details?: unknown

  constructor(payload: ApiErrorResponse) {
    super(payload.message)
    this.name = "ApiError"
    this.status = payload.status
    this.code = payload.code
    this.retryable = payload.retryable
    this.details = payload.details
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number
  params?: Record<string, string | number | boolean | undefined | null>
}

/**
 * Normalizes HTTP status codes and error responses into standardized ApiError.
 */
export function normalizeApiError(error: unknown, status = 500): ApiError {
  if (isApiError(error)) return error

  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError({
      message: "Request timed out or was cancelled.",
      status: 408,
      code: "REQUEST_TIMEOUT",
      retryable: true,
    })
  }

  if (error instanceof TypeError && error.message.toLowerCase().includes("failed to fetch")) {
    return new ApiError({
      message: "Network connection failure. Please check your connection.",
      status: 0,
      code: "NETWORK_FAILURE",
      retryable: true,
    })
  }

  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, any>
    const code =
      errObj.code ||
      errObj.error?.code ||
      (status === 401
        ? "UNAUTHORIZED"
        : status === 403
        ? "FORBIDDEN"
        : status === 404
        ? "NOT_FOUND"
        : status === 429
        ? "RATE_LIMITED"
        : status >= 500
        ? "SERVER_ERROR"
        : "BAD_REQUEST")

    const message =
      errObj.message ||
      errObj.error?.message ||
      (status === 401
        ? "Authentication required to perform this action."
        : status === 403
        ? "You do not have permission to access this resource."
        : status === 404
        ? "Resource not found."
        : status === 429
        ? "Too many requests. Please slow down."
        : "An unexpected error occurred.")

    const retryable = status === 408 || status === 429 || (status >= 500 && status <= 504) || status === 0

    return new ApiError({
      message,
      status: errObj.status || status,
      code,
      retryable,
      details: errObj.details || errObj.error || undefined,
    })
  }

  return new ApiError({
    message: String(error || "Unknown server error"),
    status,
    code: "UNKNOWN_ERROR",
    retryable: status >= 500,
  })
}

export class ApiClient {
  private baseUrl: string
  private defaultTimeoutMs: number

  constructor(
    baseUrl?: string,
    defaultTimeoutMs = 10000
  ) {
    this.baseUrl =
      baseUrl ||
      (typeof process !== "undefined" &&
        (process.env.NEXT_PUBLIC_API_URL ||
          process.env.NEXT_PUBLIC_SERVER_URL)) ||
      "http://localhost:5001"

    // Strip trailing slash if present
    if (this.baseUrl.endsWith("/")) {
      this.baseUrl = this.baseUrl.slice(0, -1)
    }

    this.defaultTimeoutMs = defaultTimeoutMs
  }

  public getBaseUrl(): string {
    return this.baseUrl
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.endsWith("/") ? url.slice(0, -1) : url
  }

  /**
   * Retrieves the current auth token from client-side storage.
   */
  private getAuthToken(): string | null {
    if (typeof window === "undefined") return null
    try {
      const token = localStorage.getItem("token")
      if (token && token.trim()) return token

      const profile = localStorage.getItem("Profile")
      if (profile) {
        const parsed = JSON.parse(profile)
        return parsed?.token || parsed?.result?.token || null
      }
    } catch {
      // Ignore localStorage access errors
    }
    return null
  }

  /**
   * Core request dispatcher with timeout and cancellation.
   */
  public async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      timeoutMs = this.defaultTimeoutMs,
      params,
      headers: customHeaders,
      signal: callerSignal,
      ...customOptions
    } = options

    // Construct URL with query parameters
    let url = endpoint.startsWith("http://") || endpoint.startsWith("https://")
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`

    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += (url.includes("?") ? "&" : "?") + queryString
      }
    }

    // Compose AbortController with timeout
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null
    let timeoutId: NodeJS.Timeout | null = null

    if (controller && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        controller.abort()
      }, timeoutMs)
    }

    // Connect caller-provided AbortSignal if present
    if (callerSignal && controller) {
      if (callerSignal.aborted) {
        controller.abort()
      } else {
        callerSignal.addEventListener("abort", () => controller.abort(), { once: true })
      }
    }

    // Compose headers
    const headers = new Headers(customHeaders || {})
    if (!headers.has("Content-Type") && !(customOptions.body instanceof FormData)) {
      headers.set("Content-Type", "application/json")
    }

    const authToken = this.getAuthToken()
    if (authToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${authToken}`)
    }

    try {
      const response = await fetch(url, {
        ...customOptions,
        headers,
        signal: controller?.signal,
      })

      if (timeoutId) clearTimeout(timeoutId)

      // Handle 204 No Content
      if (response.status === 204) {
        return null as unknown as T
      }

      // Parse JSON or text response
      const contentType = response.headers.get("content-type") || ""
      let responseData: any = null

      if (contentType.includes("application/json")) {
        try {
          responseData = await response.json()
        } catch {
          responseData = null
        }
      } else {
        responseData = await response.text()
      }

      if (!response.ok) {
        throw normalizeApiError(responseData, response.status)
      }

      return responseData as T
    } catch (err: unknown) {
      if (timeoutId) clearTimeout(timeoutId)
      throw normalizeApiError(err)
    }
  }

  public get<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" })
  }

  public post<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  public put<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  public patch<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  public delete<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" })
  }
}

export const apiClient = new ApiClient()
export default apiClient
