import { randomBytes, createHash } from "crypto";
import { createServer } from "http";
import type { McpOAuthConfig } from "./types.js";

const CALLBACK_PORT = 19283;
const CALLBACK_PATH = "/callback";

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: Date;
  scopes?: string;
}

/**
 * Interface for storing OAuth tokens.
 * Implement this to persist tokens (e.g., to a database).
 * The default implementation uses in-memory storage.
 */
export interface OAuthTokenStore {
  getTokens(serverName: string): Promise<OAuthTokens | null>;
  storeTokens(serverName: string, tokens: OAuthTokens): Promise<void>;
  clearTokens(serverName: string): Promise<void>;
}

/**
 * In-memory token store (tokens are lost on restart)
 */
class InMemoryTokenStore implements OAuthTokenStore {
  private tokens: Map<string, OAuthTokens> = new Map();

  async getTokens(serverName: string): Promise<OAuthTokens | null> {
    return this.tokens.get(serverName) ?? null;
  }

  async storeTokens(serverName: string, tokens: OAuthTokens): Promise<void> {
    this.tokens.set(serverName, tokens);
  }

  async clearTokens(serverName: string): Promise<void> {
    this.tokens.delete(serverName);
  }
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

function generateState(): string {
  return base64UrlEncode(randomBytes(16));
}

export class McpOAuthManager {
  private tokenStore: OAuthTokenStore;

  constructor(tokenStore?: OAuthTokenStore) {
    this.tokenStore = tokenStore ?? new InMemoryTokenStore();
  }

  /**
   * Set a custom token store (e.g., database-backed)
   */
  setTokenStore(store: OAuthTokenStore): void {
    this.tokenStore = store;
  }

  async getStoredTokens(serverName: string): Promise<OAuthTokens | null> {
    return this.tokenStore.getTokens(serverName);
  }

  async storeTokens(serverName: string, tokens: OAuthTokens): Promise<void> {
    return this.tokenStore.storeTokens(serverName, tokens);
  }

  async clearTokens(serverName: string): Promise<void> {
    return this.tokenStore.clearTokens(serverName);
  }

  isTokenExpired(tokens: OAuthTokens): boolean {
    if (!tokens.expiresAt) return false;
    return new Date() >= tokens.expiresAt;
  }

  async refreshTokens(
    serverName: string,
    oauthConfig: McpOAuthConfig
  ): Promise<OAuthTokens | null> {
    const stored = await this.getStoredTokens(serverName);
    if (!stored?.refreshToken) return null;

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: stored.refreshToken,
      client_id: oauthConfig.clientId,
    });

    if (oauthConfig.clientSecret) {
      params.set("client_secret", oauthConfig.clientSecret);
    }

    const response = await fetch(oauthConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
    };

    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? stored.refreshToken,
      tokenType: data.token_type ?? "Bearer",
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scopes: data.scope,
    };

    await this.storeTokens(serverName, tokens);
    return tokens;
  }

  async getValidTokens(
    serverName: string,
    oauthConfig: McpOAuthConfig
  ): Promise<OAuthTokens | null> {
    const stored = await this.getStoredTokens(serverName);
    if (!stored) return null;

    if (!this.isTokenExpired(stored)) {
      return stored;
    }

    return this.refreshTokens(serverName, oauthConfig);
  }

  async initiateOAuthFlow(
    serverName: string,
    oauthConfig: McpOAuthConfig,
    openBrowser: (url: string) => Promise<void>
  ): Promise<OAuthTokens> {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    const authParams = new URLSearchParams({
      response_type: "code",
      client_id: oauthConfig.clientId,
      redirect_uri: `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    if (oauthConfig.scopes?.length) {
      authParams.set("scope", oauthConfig.scopes.join(" "));
    }

    const authUrl = `${oauthConfig.authorizationUrl}?${authParams.toString()}`;

    const code = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error("OAuth flow timed out"));
      }, 120000);

      const server = createServer((req, res) => {
        const url = new URL(req.url!, `http://localhost:${CALLBACK_PORT}`);

        if (url.pathname !== CALLBACK_PATH) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const receivedState = url.searchParams.get("state");
        const receivedCode = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400);
          res.end(`OAuth error: ${error}`);
          clearTimeout(timeout);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (receivedState !== state) {
          res.writeHead(400);
          res.end("Invalid state parameter");
          clearTimeout(timeout);
          server.close();
          reject(new Error("Invalid state parameter"));
          return;
        }

        if (!receivedCode) {
          res.writeHead(400);
          res.end("Missing authorization code");
          clearTimeout(timeout);
          server.close();
          reject(new Error("Missing authorization code"));
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body>
              <h1>Authorization successful!</h1>
              <p>You can close this window and return to the terminal.</p>
              <script>window.close();</script>
            </body>
          </html>
        `);

        clearTimeout(timeout);
        server.close();
        resolve(receivedCode);
      });

      server.listen(CALLBACK_PORT, () => {
        openBrowser(authUrl);
      });
    });

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`,
      client_id: oauthConfig.clientId,
      code_verifier: codeVerifier,
    });

    if (oauthConfig.clientSecret) {
      tokenParams.set("client_secret", oauthConfig.clientSecret);
    }

    const tokenResponse = await fetch(oauthConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
    };

    const tokens: OAuthTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type ?? "Bearer",
      expiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined,
      scopes: tokenData.scope,
    };

    await this.storeTokens(serverName, tokens);
    return tokens;
  }
}

export const mcpOAuthManager = new McpOAuthManager();
