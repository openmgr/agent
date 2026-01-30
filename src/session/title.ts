import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ProviderName } from "../config.js";
import type { AuthConfig } from "../types.js";
import { getValidAccessToken, createOAuthFetch } from "../auth/anthropic/index.js";

const TITLE_SYSTEM_PROMPT = `You are a title generator. You output ONLY a thread title. Nothing else.

Generate a brief title that would help the user find this conversation later.

Rules:
- Output a single line, ≤50 characters
- No explanations, just the title
- Use the same language as the user message
- Title must be grammatically correct and read naturally
- Never include tool names (e.g. "read tool", "bash tool")
- Focus on the main topic or question
- Keep exact: technical terms, numbers, filenames
- Remove: the, this, my, a, an
- If the message is short/conversational (e.g. "hello"), use something like "Quick chat" or "Greeting"

Examples:
"debug 500 errors in production" → Debugging production 500 errors
"refactor user service" → Refactoring user service
"why is app.js failing" → app.js failure investigation
"implement rate limiting" → Rate limiting implementation`;

async function createModel(provider: ProviderName, auth: AuthConfig, modelId: string) {
  if (provider === "anthropic") {
    if (auth.type === "oauth") {
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        throw new Error("Not logged in");
      }
      const oauthFetch = await createOAuthFetch();
      const client = createAnthropic({
        apiKey: "",
        fetch: oauthFetch,
        headers: {
          "anthropic-beta": "oauth-2025-04-20",
        },
      });
      return client(modelId);
    } else {
      const client = createAnthropic({ apiKey: auth.apiKey ?? undefined });
      return client(modelId);
    }
  } else if (provider === "openai") {
    const client = createOpenAI({ apiKey: auth.apiKey ?? process.env.OPENAI_API_KEY ?? undefined });
    return client(modelId);
  } else if (provider === "google") {
    const client = createGoogleGenerativeAI({ apiKey: auth.apiKey ?? process.env.GOOGLE_API_KEY ?? undefined });
    return client(modelId);
  }
  
  const client = createAnthropic({ apiKey: auth.apiKey ?? process.env.ANTHROPIC_API_KEY ?? undefined });
  return client(modelId);
}

export async function generateTitle(
  userMessage: string,
  provider: ProviderName = "anthropic",
  auth: AuthConfig = { type: "oauth" },
  model?: string
): Promise<string> {
  const smallModel = model ?? getSmallModel(provider);
  
  try {
    const aiModel = await createModel(provider, auth, smallModel);
    
    const result = await generateText({
      model: aiModel,
      system: TITLE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate a title for this conversation:\n\n${userMessage}`,
        },
      ],
      maxTokens: 100,
    });

    const title = result.text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (!title) return "New conversation";
    
    return title.length > 50 ? title.substring(0, 47) + "..." : title;
  } catch (e) {
    console.error("Title generation failed:", e);
    return "New conversation";
  }
}

function getSmallModel(provider: ProviderName): string {
  switch (provider) {
    case "anthropic":
      return "claude-3-5-haiku-20241022";
    case "openai":
      return "gpt-4o-mini";
    case "google":
      return "gemini-1.5-flash";
    case "groq":
      return "llama-3.1-8b-instant";
    default:
      return "claude-3-5-haiku-20241022";
  }
}
