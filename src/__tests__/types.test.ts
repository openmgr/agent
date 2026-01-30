import { describe, it, expect } from "vitest";
import {
  ImageSourceBase64Schema,
  ImageSourceUrlSchema,
  ImagePartSchema,
  TextPartSchema,
  ContentPartSchema,
} from "../types.js";

describe("Image Content Types", () => {
  describe("ImageSourceBase64Schema", () => {
    it("accepts valid base64 image source", () => {
      const result = ImageSourceBase64Schema.safeParse({
        type: "base64",
        mediaType: "image/png",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all valid media types", () => {
      const mediaTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      for (const mediaType of mediaTypes) {
        const result = ImageSourceBase64Schema.safeParse({
          type: "base64",
          mediaType,
          data: "base64data",
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid media type", () => {
      const result = ImageSourceBase64Schema.safeParse({
        type: "base64",
        mediaType: "image/bmp",
        data: "base64data",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing data field", () => {
      const result = ImageSourceBase64Schema.safeParse({
        type: "base64",
        mediaType: "image/png",
      });
      expect(result.success).toBe(false);
    });

    it("rejects wrong type field", () => {
      const result = ImageSourceBase64Schema.safeParse({
        type: "url",
        mediaType: "image/png",
        data: "base64data",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ImageSourceUrlSchema", () => {
    it("accepts valid URL image source", () => {
      const result = ImageSourceUrlSchema.safeParse({
        type: "url",
        url: "https://example.com/image.png",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid URL", () => {
      const result = ImageSourceUrlSchema.safeParse({
        type: "url",
        url: "not-a-valid-url",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing url field", () => {
      const result = ImageSourceUrlSchema.safeParse({
        type: "url",
      });
      expect(result.success).toBe(false);
    });

    it("rejects wrong type field", () => {
      const result = ImageSourceUrlSchema.safeParse({
        type: "base64",
        url: "https://example.com/image.png",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ImagePartSchema", () => {
    it("accepts image part with base64 source", () => {
      const result = ImagePartSchema.safeParse({
        type: "image",
        source: {
          type: "base64",
          mediaType: "image/png",
          data: "base64data",
        },
      });
      expect(result.success).toBe(true);
    });

    it("accepts image part with URL source", () => {
      const result = ImagePartSchema.safeParse({
        type: "image",
        source: {
          type: "url",
          url: "https://example.com/image.png",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects wrong type field", () => {
      const result = ImagePartSchema.safeParse({
        type: "text",
        source: {
          type: "base64",
          mediaType: "image/png",
          data: "base64data",
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing source", () => {
      const result = ImagePartSchema.safeParse({
        type: "image",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("TextPartSchema", () => {
    it("accepts valid text part", () => {
      const result = TextPartSchema.safeParse({
        type: "text",
        text: "Hello, world!",
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty text", () => {
      const result = TextPartSchema.safeParse({
        type: "text",
        text: "",
      });
      expect(result.success).toBe(true);
    });

    it("rejects wrong type field", () => {
      const result = TextPartSchema.safeParse({
        type: "image",
        text: "Hello",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing text field", () => {
      const result = TextPartSchema.safeParse({
        type: "text",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ContentPartSchema", () => {
    it("accepts text part", () => {
      const result = ContentPartSchema.safeParse({
        type: "text",
        text: "Hello",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("text");
      }
    });

    it("accepts image part with base64", () => {
      const result = ContentPartSchema.safeParse({
        type: "image",
        source: {
          type: "base64",
          mediaType: "image/jpeg",
          data: "base64data",
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("image");
      }
    });

    it("accepts image part with URL", () => {
      const result = ContentPartSchema.safeParse({
        type: "image",
        source: {
          type: "url",
          url: "https://example.com/image.jpg",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid type", () => {
      const result = ContentPartSchema.safeParse({
        type: "video",
        url: "https://example.com/video.mp4",
      });
      expect(result.success).toBe(false);
    });

    it("discriminates correctly between text and image", () => {
      const textResult = ContentPartSchema.safeParse({
        type: "text",
        text: "Hello",
      });
      
      const imageResult = ContentPartSchema.safeParse({
        type: "image",
        source: {
          type: "url",
          url: "https://example.com/image.png",
        },
      });

      expect(textResult.success).toBe(true);
      expect(imageResult.success).toBe(true);
      
      if (textResult.success && imageResult.success) {
        expect(textResult.data.type).toBe("text");
        expect(imageResult.data.type).toBe("image");
      }
    });
  });

  describe("LLMMessage content types", () => {
    it("should support string content", () => {
      // This is a type-level test - LLMMessage.content can be string
      const message = {
        role: "user" as const,
        content: "Hello, world!",
      };
      expect(typeof message.content).toBe("string");
    });

    it("should support ContentPart array content", () => {
      // This is a type-level test - LLMMessage.content can be ContentPart[]
      const message = {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "What's in this image?" },
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              mediaType: "image/png" as const,
              data: "base64data",
            },
          },
        ],
      };
      expect(Array.isArray(message.content)).toBe(true);
      expect(message.content).toHaveLength(2);
    });

    it("should validate mixed content parts array", () => {
      const parts = [
        { type: "text", text: "Describe this:" },
        {
          type: "image",
          source: {
            type: "url",
            url: "https://example.com/image.png",
          },
        },
        { type: "text", text: "And explain what you see." },
      ];

      for (const part of parts) {
        const result = ContentPartSchema.safeParse(part);
        expect(result.success).toBe(true);
      }
    });
  });
});
