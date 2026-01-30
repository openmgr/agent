/**
 * Global test setup for vitest
 * This file is loaded before all tests
 */

import { afterEach, vi } from "vitest";

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Suppress console warnings during tests unless DEBUG is set
if (!process.env.DEBUG) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
}
