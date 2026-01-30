import { vi } from "vitest";

/**
 * Mock fetch response
 */
export interface MockFetchResponse {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  text?: string;
  json?: unknown;
}

/**
 * Create a mock Response object
 */
export function createMockResponse(options: MockFetchResponse): Response {
  const headers = new Headers(options.headers ?? {});
  
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? "OK",
    headers,
    text: async () => options.text ?? "",
    json: async () => options.json ?? {},
    blob: async () => new Blob([options.text ?? ""]),
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    clone: () => createMockResponse(options),
    body: null,
    bodyUsed: false,
    redirected: false,
    type: "basic" as const,
    url: "",
    bytes: async () => new Uint8Array(),
  } as Response;
}

/**
 * Create a mock fetch function that returns specified responses
 */
export function createMockFetch(responses: MockFetchResponse[] | MockFetchResponse) {
  const responseArray = Array.isArray(responses) ? responses : [responses];
  let callIndex = 0;
  const calls: Array<{ url: string; options?: RequestInit }> = [];

  const mockFetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const urlString = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    calls.push({ url: urlString, options });
    
    const response = responseArray[callIndex % responseArray.length];
    callIndex++;
    
    return createMockResponse(response);
  });

  return {
    fetch: mockFetch,
    calls,
    reset: () => {
      callIndex = 0;
      calls.length = 0;
      mockFetch.mockClear();
    },
  };
}

/**
 * Setup global fetch mock
 */
export function mockGlobalFetch(responses: MockFetchResponse[] | MockFetchResponse) {
  const mock = createMockFetch(responses);
  const originalFetch = globalThis.fetch;
  
  globalThis.fetch = mock.fetch as typeof fetch;

  return {
    ...mock,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/**
 * Create a mock that returns different responses based on URL patterns
 */
export function createRoutedMockFetch(routes: Record<string, MockFetchResponse>) {
  const calls: Array<{ url: string; options?: RequestInit }> = [];

  const mockFetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const urlString = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    calls.push({ url: urlString, options });

    for (const [pattern, response] of Object.entries(routes)) {
      if (urlString.includes(pattern)) {
        return createMockResponse(response);
      }
    }

    // Default 404 response
    return createMockResponse({ ok: false, status: 404, statusText: "Not Found" });
  });

  return {
    fetch: mockFetch,
    calls,
    reset: () => {
      calls.length = 0;
      mockFetch.mockClear();
    },
  };
}
