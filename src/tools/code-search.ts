import { z } from "zod";
import { defineTool } from "./registry.js";

const API_CONFIG = {
  BASE_URL: "https://mcp.exa.ai",
  ENDPOINT: "/mcp",
  DEFAULT_TOKENS: 5000,
  TIMEOUT_MS: 30000,
} as const;

interface McpCodeRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: {
    name: string;
    arguments: {
      query: string;
      tokensNum: number;
    };
  };
}

interface McpCodeResponse {
  jsonrpc: string;
  result: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
}

const DESCRIPTION = `Find real-world code examples from GitHub repositories to help answer programming questions.

Use this tool when:
- Implementing unfamiliar APIs or libraries and need to see real usage patterns
- Unsure about correct syntax, parameters, or configuration for a specific library
- Looking for production-ready examples and best practices
- Need to understand how different libraries or frameworks work together

Examples of good queries:
- "React useState hook examples"
- "Python pandas dataframe filtering"
- "Express.js middleware authentication"
- "Next.js API routes with TypeScript"
- "Drizzle ORM SQLite queries"`;

export const codeSearchTool = defineTool({
  name: "code_search",
  description: DESCRIPTION,
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Search query to find relevant code examples for APIs, Libraries, and SDKs"
      ),
    tokensNum: z
      .number()
      .min(1000)
      .max(50000)
      .optional()
      .describe(
        "Number of tokens to return (1000-50000). Default is 5000. Use lower values for focused queries, higher for comprehensive documentation."
      ),
  }),
  async execute(params, ctx) {
    const codeRequest: McpCodeRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get_code_context_exa",
        arguments: {
          query: params.query,
          tokensNum: params.tokensNum || API_CONFIG.DEFAULT_TOKENS,
        },
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

    try {
      const signals = ctx.abortSignal
        ? [controller.signal, ctx.abortSignal]
        : [controller.signal];

      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINT}`,
        {
          method: "POST",
          headers: {
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
          },
          body: JSON.stringify(codeRequest),
          signal: AbortSignal.any(signals),
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          output: `Code search error (${response.status}): ${errorText}`,
          metadata: { error: true, status: response.status },
        };
      }

      const responseText = await response.text();

      const lines = responseText.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data: McpCodeResponse = JSON.parse(line.substring(6));
          if (data.result?.content?.length > 0) {
            return {
              output: data.result.content[0].text,
              metadata: {
                query: params.query,
                tokensNum: params.tokensNum || API_CONFIG.DEFAULT_TOKENS,
              },
            };
          }
        }
      }

      return {
        output:
          "No code snippets or documentation found. Please try a different query, be more specific about the library or programming concept, or check the spelling of framework names.",
        metadata: { query: params.query, count: 0 },
      };
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error && err.name === "AbortError") {
        return {
          output: "Code search request timed out",
          metadata: { error: true, timeout: true },
        };
      }

      return {
        output: `Code search failed: ${(err as Error).message}`,
        metadata: { error: true },
      };
    }
  },
});
