/**
 * Test utilities exports
 * Import from this module for easy access to mocks, fixtures, and helpers
 */

// Mocks
export {
  createMockLLMProvider,
  createMockResponse,
  createMockStream,
  createMockToolCall,
  createLLMSpies,
  createToolCallingProvider,
  textChunks,
  toolCallChunks,
} from "./mocks/llm.js";

// Helpers
export {
  createTempDir,
  useTempDir,
  type TempDirContext,
} from "./helpers/temp-dir.js";

// Message fixtures
export {
  createUserMessage,
  createAssistantMessage,
  createToolResultMessage,
  createToolCall,
  createToolResult,
  sampleConversations,
} from "./fixtures/messages.js";

// Config fixtures
export {
  minimalConfig,
  fullConfig,
  resolvedConfig,
  oauthConfig,
  providerConfigs,
} from "./fixtures/config.js";
