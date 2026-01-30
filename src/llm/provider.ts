import type { LLMProvider, AuthConfig } from "../types.js";

export interface ProviderOptions {
  auth?: AuthConfig;
}

export abstract class BaseLLMProvider implements LLMProvider {
  protected auth: AuthConfig;

  constructor(options: ProviderOptions = {}) {
    this.auth = options.auth ?? { type: "oauth" };
  }

  abstract stream(options: Parameters<LLMProvider["stream"]>[0]): ReturnType<LLMProvider["stream"]>;
}
