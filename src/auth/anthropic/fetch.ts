import { loadStoredTokens, refreshAccessToken } from "./oauth.js";
import { writeFileSync } from "fs";

const TOOL_PREFIX = "mcp_";
const DEBUG_OAUTH = process.env.DEBUG_OAUTH === "1";
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

    if (parsed.system && Array.isArray(parsed.system)) {
      const firstItem = parsed.system[0];
      if (firstItem?.type === "text" && typeof firstItem.text === "string") {
        if (firstItem.text !== CLAUDE_CODE_SYSTEM_PREFIX) {
          const sanitizedText = firstItem.text
            .replace(/OpenCode/g, "Claude Code")
            .replace(/opencode/gi, "Claude")
            .replace(/OpenMgr/gi, "Claude Code");
          parsed.system = [
            { type: "text", text: CLAUDE_CODE_SYSTEM_PREFIX, cache_control: { type: "ephemeral" } },
            { type: "text", text: sanitizedText, cache_control: { type: "ephemeral" } },
            ...parsed.system.slice(1),
          ];
        }
      }
    }

    if (parsed.tools && Array.isArray(parsed.tools)) {
      parsed.tools = parsed.tools.map((tool: Record<string, unknown>) => ({
        ...tool,
        name: tool.name ? `${TOOL_PREFIX}${tool.name}` : tool.name,
      }));
    }

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

export async function createOAuthFetch(): Promise<typeof fetch> {
  const oauthFetch: typeof fetch = async (input, init) => {
    const accessToken = await ensureValidToken();

    const requestInit = init ?? {};
    const requestHeaders = new Headers();

    if (input instanceof Request) {
      input.headers.forEach((value, key) => {
        requestHeaders.set(key, value);
      });
    }

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

    let body = requestInit.body;
    if (body && typeof body === "string") {
      body = transformRequestBody(body);
    }

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

    requestHeaders.set("authorization", `Bearer ${accessToken}`);
    requestHeaders.set("anthropic-beta", mergedBetas);
    requestHeaders.set("user-agent", "claude-cli/2.1.2 (external, cli)");
    requestHeaders.delete("x-api-key");

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

    if (requestUrl && requestUrl.pathname === "/v1/messages" && !requestUrl.searchParams.has("beta")) {
      requestUrl.searchParams.set("beta", "true");
      requestInput = input instanceof Request
        ? new Request(requestUrl.toString(), input)
        : requestUrl;
    }

    if (DEBUG_OAUTH) {
      const headersObj: Record<string, string> = {};
      requestHeaders.forEach((v, k) => { headersObj[k] = k === "authorization" ? "Bearer [REDACTED]" : v; });
      const debugInfo = {
        url: requestUrl?.toString() ?? String(requestInput),
        method: requestInit.method ?? "POST",
        headers: headersObj,
        body: body ? JSON.parse(body as string) : null,
      };
      writeFileSync("/tmp/openmgr-oauth-request.json", JSON.stringify(debugInfo, null, 2));
      console.error("[DEBUG_OAUTH] Request dumped to /tmp/openmgr-oauth-request.json");
    }

    const response = await fetch(requestInput, {
      ...requestInit,
      body,
      headers: requestHeaders,
    });

    if (DEBUG_OAUTH && !response.ok) {
      const cloned = response.clone();
      const errorText = await cloned.text();
      writeFileSync("/tmp/openmgr-oauth-response.txt", `Status: ${response.status}\n\n${errorText}`);
      console.error("[DEBUG_OAUTH] Error response dumped to /tmp/openmgr-oauth-response.txt");
    }

    return transformResponseStream(response);
  };

  return oauthFetch;
}
