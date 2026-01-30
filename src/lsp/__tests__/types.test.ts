import { describe, it, expect } from "vitest";
import {
  getLanguageId,
  LANGUAGE_IDS,
  DEFAULT_LANGUAGE_SERVERS,
  DiagnosticSeverity,
} from "../types.js";

describe("LSP types", () => {
  describe("LANGUAGE_IDS", () => {
    it("should map common TypeScript extensions", () => {
      expect(LANGUAGE_IDS[".ts"]).toBe("typescript");
      expect(LANGUAGE_IDS[".tsx"]).toBe("typescriptreact");
    });

    it("should map common JavaScript extensions", () => {
      expect(LANGUAGE_IDS[".js"]).toBe("javascript");
      expect(LANGUAGE_IDS[".jsx"]).toBe("javascriptreact");
      expect(LANGUAGE_IDS[".mjs"]).toBe("javascript");
      expect(LANGUAGE_IDS[".cjs"]).toBe("javascript");
    });

    it("should map Go extensions", () => {
      expect(LANGUAGE_IDS[".go"]).toBe("go");
    });

    it("should map Python extensions", () => {
      expect(LANGUAGE_IDS[".py"]).toBe("python");
    });

    it("should map Rust extensions", () => {
      expect(LANGUAGE_IDS[".rs"]).toBe("rust");
    });

    it("should map common config file extensions", () => {
      expect(LANGUAGE_IDS[".json"]).toBe("json");
      expect(LANGUAGE_IDS[".yaml"]).toBe("yaml");
      expect(LANGUAGE_IDS[".yml"]).toBe("yaml");
      expect(LANGUAGE_IDS[".toml"]).toBe("toml");
    });

    it("should map web extensions", () => {
      expect(LANGUAGE_IDS[".html"]).toBe("html");
      expect(LANGUAGE_IDS[".css"]).toBe("css");
      expect(LANGUAGE_IDS[".scss"]).toBe("scss");
    });

    it("should map C/C++ extensions", () => {
      expect(LANGUAGE_IDS[".c"]).toBe("c");
      expect(LANGUAGE_IDS[".cpp"]).toBe("cpp");
      expect(LANGUAGE_IDS[".cc"]).toBe("cpp");
      expect(LANGUAGE_IDS[".h"]).toBe("c");
      expect(LANGUAGE_IDS[".hpp"]).toBe("cpp");
    });
  });

  describe("getLanguageId", () => {
    it("should detect TypeScript files", () => {
      expect(getLanguageId("/path/to/file.ts")).toBe("typescript");
      expect(getLanguageId("/path/to/file.tsx")).toBe("typescriptreact");
    });

    it("should detect JavaScript files", () => {
      expect(getLanguageId("/path/to/file.js")).toBe("javascript");
      expect(getLanguageId("/path/to/file.jsx")).toBe("javascriptreact");
      expect(getLanguageId("/path/to/file.mjs")).toBe("javascript");
    });

    it("should detect Go files", () => {
      expect(getLanguageId("/path/to/main.go")).toBe("go");
    });

    it("should detect Python files", () => {
      expect(getLanguageId("/path/to/script.py")).toBe("python");
    });

    it("should detect Rust files", () => {
      expect(getLanguageId("/path/to/lib.rs")).toBe("rust");
    });

    it("should handle special files without extensions", () => {
      expect(getLanguageId("/path/to/Dockerfile")).toBe("dockerfile");
      expect(getLanguageId("/path/to/dockerfile")).toBe("dockerfile");
      expect(getLanguageId("/path/to/Makefile")).toBe("makefile");
      expect(getLanguageId("/path/to/GNUmakefile")).toBe("makefile");
      expect(getLanguageId("/path/to/CMakeLists.txt")).toBe("cmake");
    });

    it("should be case-insensitive for extensions", () => {
      expect(getLanguageId("/path/to/file.TS")).toBe("typescript");
      expect(getLanguageId("/path/to/file.Py")).toBe("python");
    });

    it("should return undefined for unknown extensions", () => {
      expect(getLanguageId("/path/to/file.xyz")).toBeUndefined();
      expect(getLanguageId("/path/to/file")).toBeUndefined();
    });

    it("should handle files with multiple dots", () => {
      expect(getLanguageId("/path/to/file.test.ts")).toBe("typescript");
      expect(getLanguageId("/path/to/file.spec.js")).toBe("javascript");
      expect(getLanguageId("/path/to/config.local.json")).toBe("json");
    });
  });

  describe("DEFAULT_LANGUAGE_SERVERS", () => {
    it("should have TypeScript server config", () => {
      const config = DEFAULT_LANGUAGE_SERVERS.typescript;
      expect(config).toBeDefined();
      expect(config.command).toBe("typescript-language-server");
      expect(config.args).toContain("--stdio");
      expect(config.rootPatterns).toContain("tsconfig.json");
    });

    it("should have JavaScript server config", () => {
      const config = DEFAULT_LANGUAGE_SERVERS.javascript;
      expect(config).toBeDefined();
      expect(config.command).toBe("typescript-language-server");
      expect(config.args).toContain("--stdio");
    });

    it("should have Go server config", () => {
      const config = DEFAULT_LANGUAGE_SERVERS.go;
      expect(config).toBeDefined();
      expect(config.command).toBe("gopls");
      expect(config.rootPatterns).toContain("go.mod");
    });

    it("should have Python server config", () => {
      const config = DEFAULT_LANGUAGE_SERVERS.python;
      expect(config).toBeDefined();
      expect(config.command).toBe("pyright-langserver");
      expect(config.args).toContain("--stdio");
    });

    it("should have Rust server config", () => {
      const config = DEFAULT_LANGUAGE_SERVERS.rust;
      expect(config).toBeDefined();
      expect(config.command).toBe("rust-analyzer");
      expect(config.rootPatterns).toContain("Cargo.toml");
    });

    it("should have valid structure for all configs", () => {
      for (const [lang, config] of Object.entries(DEFAULT_LANGUAGE_SERVERS)) {
        expect(typeof config.command).toBe("string");
        expect(config.command.length).toBeGreaterThan(0);
        if (config.args) {
          expect(Array.isArray(config.args)).toBe(true);
        }
        if (config.rootPatterns) {
          expect(Array.isArray(config.rootPatterns)).toBe(true);
        }
      }
    });
  });

  describe("DiagnosticSeverity", () => {
    it("should have correct severity values", () => {
      expect(DiagnosticSeverity.Error).toBe(1);
      expect(DiagnosticSeverity.Warning).toBe(2);
      expect(DiagnosticSeverity.Information).toBe(3);
      expect(DiagnosticSeverity.Hint).toBe(4);
    });
  });
});
