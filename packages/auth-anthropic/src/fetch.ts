import { loadStoredTokens, refreshAccessToken } from "./oauth.js";

const TOOL_PREFIX = "mcp_";
const CLAUDE_CODE_SYSTEM_PREFIX = "You are Claude Code, Anthropic's official CLI for Claude.";

async function ensureValidToken(): Promise<string> {
  const tokens = await loadStoredTokens();
  if (!tokens) {
    throw new Error("Not logged in. Run 'openmgr-agent login anthropic' to authenticate");
  }

  if (!tokens.accessToken || tokens.expiresAt < Date.now()) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    return refreshed.accessToken;
  }

  return tokens.accessToken;
}

function transformRequestBody(body: string): string {
  try {
    const parsed = JSON.parse(body);

    // Transform system prompt
    if (parsed.system && Array.isArray(parsed.system)) {
      const firstItem = parsed.system[0];
      if (firstItem?.type === "text" && typeof firstItem.text === "string") {
        if (firstItem.text !== CLAUDE_CODE_SYSTEM_PREFIX) {
          const sanitizedText = firstItem.text
            .replace(/OpenMgr Agent/gi, "Claude Code")
            .replace(/openmgr-agent/gi, "Claude")
            .replace(/openmgr/gi, "Claude Code");
          parsed.system = [
            { type: "text", text: CLAUDE_CODE_SYSTEM_PREFIX, cache_control: { type: "ephemeral" } },
            { type: "text", text: sanitizedText, cache_control: { type: "ephemeral" } },
            ...parsed.system.slice(1),
          ];
        }
      }
    }

    // Transform tool names
    if (parsed.tools && Array.isArray(parsed.tools)) {
      parsed.tools = parsed.tools.map((tool: Record<string, unknown>) => ({
        ...tool,
        name: tool.name ? `${TOOL_PREFIX}${tool.name}` : tool.name,
      }));
    }

    // Transform tool calls in messages
    if (parsed.messages && Array.isArray(parsed.messages)) {
      parsed.messages = parsed.messages.map((msg: Record<string, unknown>) => {
        if (msg.content && Array.isArray(msg.content)) {
          msg.content = (msg.content as Record<string, unknown>[]).map((block) => {
            if (block.type === "tool_use" && typeof block.name === "string") {
              return { ...block, name: `${TOOL_PREFIX}${block.name}` };
            }
            return block;
          });
        }
        return msg;
      });
    }

    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}

function transformResponseStream(response: Response): Response {
  if (!response.body) return response;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      // Remove mcp_ prefix from tool names in response
      let text = decoder.decode(value, { stream: true });
      text = text.replace(/"name"\s*:\s*"mcp_([^"]+)"/g, '"name": "$1"');
      controller.enqueue(encoder.encode(text));
    },
  });

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Create a fetch function that handles OAuth authentication.
 * 
 * This wraps the standard fetch and:
 * 1. Adds OAuth bearer token
 * 2. Transforms tool names (adds mcp_ prefix)
 * 3. Adds required Anthropic headers
 */
export async function createOAuthFetch(): Promise<typeof fetch> {
  const oauthFetch: typeof fetch = async (input, init) => {
    const accessToken = await ensureValidToken();

    const requestInit = init ?? {};
    const requestHeaders = new Headers();

    // Copy headers from Request if input is a Request
    if (input instanceof Request) {
      input.headers.forEach((value, key) => {
        requestHeaders.set(key, value);
      });
    }

    // Copy headers from init
    if (requestInit.headers) {
      if (requestInit.headers instanceof Headers) {
        requestInit.headers.forEach((value, key) => {
          requestHeaders.set(key, value);
        });
      } else if (Array.isArray(requestInit.headers)) {
        for (const [key, value] of requestInit.headers) {
          if (typeof value !== "undefined") {
            requestHeaders.set(key, String(value));
          }
        }
      } else {
        for (const [key, value] of Object.entries(requestInit.headers)) {
          if (typeof value !== "undefined") {
            requestHeaders.set(key, String(value));
          }
        }
      }
    }

    // Transform request body
    let body = requestInit.body;
    if (body && typeof body === "string") {
      body = transformRequestBody(body);
    }

    // Merge beta headers
    const incomingBeta = requestHeaders.get("anthropic-beta") || "";
    const incomingBetasList = incomingBeta
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);

    const includeClaudeCode = incomingBetasList.includes("claude-code-20250219");

    const mergedBetas = [
      "oauth-2025-04-20",
      "interleaved-thinking-2025-05-14",
      ...(includeClaudeCode ? ["claude-code-20250219", "fine-grained-tool-streaming-2025-05-14"] : []),
    ].join(",");

    // Set OAuth headers
    requestHeaders.set("authorization", `Bearer ${accessToken}`);
    requestHeaders.set("anthropic-beta", mergedBetas);
    requestHeaders.set("user-agent", "claude-cli/2.1.2 (external, cli)");
    requestHeaders.delete("x-api-key");

    // Handle URL transformation
    let requestInput: Request | string | URL = input;
    let requestUrl: URL | null = null;

    try {
      if (typeof input === "string" || input instanceof URL) {
        requestUrl = new URL(input.toString());
      } else if (input instanceof Request) {
        requestUrl = new URL(input.url);
      }
    } catch {
      requestUrl = null;
    }

    // Add beta=true query param for messages endpoint
    if (requestUrl && requestUrl.pathname === "/v1/messages" && !requestUrl.searchParams.has("beta")) {
      requestUrl.searchParams.set("beta", "true");
      requestInput = input instanceof Request
        ? new Request(requestUrl.toString(), input)
        : requestUrl;
    }

    const response = await fetch(requestInput, {
      ...requestInit,
      body,
      headers: requestHeaders,
    });

    return transformResponseStream(response);
  };

  return oauthFetch;
}
