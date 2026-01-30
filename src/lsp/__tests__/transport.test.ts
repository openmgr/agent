import { describe, it, expect, vi, beforeEach } from "vitest";
import { LspTransport } from "../transport.js";
import { PassThrough } from "stream";

describe("LspTransport", () => {
  let mockReader: PassThrough;
  let mockWriter: PassThrough;
  let transport: LspTransport;

  beforeEach(() => {
    mockReader = new PassThrough();
    mockWriter = new PassThrough();
    transport = new LspTransport(mockReader, mockWriter);
  });

  describe("message sending", () => {
    it("should send a JSON-RPC request with proper headers", () => {
      const chunks: Buffer[] = [];
      mockWriter.on("data", (chunk) => chunks.push(chunk));

      transport.sendRequest(1, "test", { foo: "bar" });

      const writtenData = Buffer.concat(chunks).toString("utf-8");
      
      // Should have Content-Length header
      expect(writtenData).toContain("Content-Length:");
      
      // Should have the JSON body
      expect(writtenData).toContain('"jsonrpc":"2.0"');
      expect(writtenData).toContain('"method":"test"');
      expect(writtenData).toContain('"id":1');
    });

    it("should calculate correct Content-Length for UTF-8", () => {
      const chunks: Buffer[] = [];
      mockWriter.on("data", (chunk) => chunks.push(chunk));

      transport.sendRequest(1, "test", { unicode: "test" });

      const writtenData = Buffer.concat(chunks).toString("utf-8");
      const match = writtenData.match(/Content-Length: (\d+)/);
      expect(match).toBeTruthy();
      
      const contentLength = parseInt(match![1], 10);
      const bodyStart = writtenData.indexOf("\r\n\r\n") + 4;
      const body = writtenData.slice(bodyStart);
      
      // Content-Length should match byte length of body
      expect(Buffer.byteLength(body, "utf-8")).toBe(contentLength);
    });

    it("should send notifications without id", () => {
      const chunks: Buffer[] = [];
      mockWriter.on("data", (chunk) => chunks.push(chunk));

      transport.sendNotification("$/notify", { data: 123 });

      const writtenData = Buffer.concat(chunks).toString("utf-8");
      expect(writtenData).toContain('"method":"$/notify"');
      // Notification should not have an id field
      const body = writtenData.slice(writtenData.indexOf("\r\n\r\n") + 4);
      const parsed = JSON.parse(body);
      expect(parsed.id).toBeUndefined();
    });

    it("should send responses with result", () => {
      const chunks: Buffer[] = [];
      mockWriter.on("data", (chunk) => chunks.push(chunk));

      transport.sendResponse(1, { success: true });

      const writtenData = Buffer.concat(chunks).toString("utf-8");
      const body = writtenData.slice(writtenData.indexOf("\r\n\r\n") + 4);
      const parsed = JSON.parse(body);
      
      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.id).toBe(1);
      expect(parsed.result).toEqual({ success: true });
    });

    it("should send error responses", () => {
      const chunks: Buffer[] = [];
      mockWriter.on("data", (chunk) => chunks.push(chunk));

      transport.sendResponse(1, undefined, { code: -32600, message: "Invalid Request" });

      const writtenData = Buffer.concat(chunks).toString("utf-8");
      const body = writtenData.slice(writtenData.indexOf("\r\n\r\n") + 4);
      const parsed = JSON.parse(body);
      
      expect(parsed.error.code).toBe(-32600);
      expect(parsed.error.message).toBe("Invalid Request");
    });
  });

  describe("message receiving", () => {
    it("should call message handler when receiving valid JSON-RPC", () => {
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      const message = { jsonrpc: "2.0", id: 1, result: "test" };
      const body = JSON.stringify(message);
      const data = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;

      mockReader.push(Buffer.from(data));

      expect(messageHandler).toHaveBeenCalledWith(message);
    });

    it("should handle chunked data", () => {
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      const message = { jsonrpc: "2.0", id: 1, result: "chunked" };
      const body = JSON.stringify(message);
      const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;

      // Send data in chunks
      mockReader.push(Buffer.from(header));
      mockReader.push(Buffer.from(body));

      expect(messageHandler).toHaveBeenCalledWith(message);
    });

    it("should handle multiple messages in one chunk", () => {
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      const msg1 = { jsonrpc: "2.0", id: 1, result: "first" };
      const msg2 = { jsonrpc: "2.0", id: 2, result: "second" };
      const body1 = JSON.stringify(msg1);
      const body2 = JSON.stringify(msg2);
      const data = 
        `Content-Length: ${Buffer.byteLength(body1)}\r\n\r\n${body1}` +
        `Content-Length: ${Buffer.byteLength(body2)}\r\n\r\n${body2}`;

      mockReader.push(Buffer.from(data));

      expect(messageHandler).toHaveBeenCalledTimes(2);
      expect(messageHandler).toHaveBeenNthCalledWith(1, msg1);
      expect(messageHandler).toHaveBeenNthCalledWith(2, msg2);
    });

    it("should call error handler for invalid JSON", () => {
      const errorHandler = vi.fn();
      transport.onError(errorHandler);

      const invalidBody = "not valid json";
      const data = `Content-Length: ${Buffer.byteLength(invalidBody)}\r\n\r\n${invalidBody}`;

      mockReader.push(Buffer.from(data));

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it("should handle incomplete messages gracefully", () => {
      const messageHandler = vi.fn();
      transport.onMessage(messageHandler);

      // Send incomplete data
      mockReader.push(Buffer.from("Content-Length: 100\r\n\r\n"));
      mockReader.push(Buffer.from('{"partial":'));

      // Should not call handler yet (waiting for more data)
      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe("close handling", () => {
    it("should call close handler when reader ends", async () => {
      const closeHandler = vi.fn();
      transport.onClose(closeHandler);

      // Push null to signal end, then wait for event to propagate
      mockReader.push(null);
      await new Promise(resolve => setImmediate(resolve));

      expect(closeHandler).toHaveBeenCalled();
    });

    it("should set closed state after close", async () => {
      expect(transport.closed).toBe(false);
      
      mockReader.push(null);
      await new Promise(resolve => setImmediate(resolve));
      
      expect(transport.closed).toBe(true);
    });

    it("should not send messages after close", async () => {
      const chunks: Buffer[] = [];
      mockWriter.on("data", (chunk) => chunks.push(chunk));

      mockReader.push(null); // Close the transport
      await new Promise(resolve => setImmediate(resolve));
      
      transport.sendRequest(1, "test");
      
      // No data should be written
      expect(chunks.length).toBe(0);
    });
  });
});
