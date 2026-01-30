import { randomBytes, createHash } from "crypto";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

const OAUTH_CONFIG = {
  clientId: CLIENT_ID,
  authorizationUrl: "https://claude.ai/oauth/authorize",
  tokenUrl: "https://console.anthropic.com/v1/oauth/token",
  redirectUri: "https://console.anthropic.com/oauth/code/callback",
  scope: "org:create_api_key user:profile user:inference",
};

const AUTH_DIR = join(homedir(), ".config", "openmgr");
const AUTH_FILE = join(AUTH_DIR, "anthropic-oauth.json");

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface StoredAuth {
  type: "oauth";
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function loadStoredTokens(): Promise<OAuthTokens | null> {
  try {
    if (!existsSync(AUTH_FILE)) return null;
    const content = await readFile(AUTH_FILE, "utf-8");
    const stored: StoredAuth = JSON.parse(content);
    if (stored.type !== "oauth") return null;
    return {
      accessToken: stored.access_token,
      refreshToken: stored.refresh_token,
      expiresAt: stored.expires_at,
    };
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: OAuthTokens): Promise<void> {
  await mkdir(AUTH_DIR, { recursive: true });
  const stored: StoredAuth = {
    type: "oauth",
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: tokens.expiresAt,
  };
  await writeFile(AUTH_FILE, JSON.stringify(stored, null, 2), "utf-8");
}

export async function clearTokens(): Promise<void> {
  await unlink(AUTH_FILE).catch(() => {});
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<OAuthTokens> {
  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const tokens: OAuthTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  await saveTokens(tokens);
  return tokens;
}

const TOKEN_REFRESH_BUFFER_SECONDS = 300;

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await loadStoredTokens();
  if (!tokens) return null;

  const now = Date.now();

  if (tokens.expiresAt - TOKEN_REFRESH_BUFFER_SECONDS * 1000 > now) {
    return tokens.accessToken;
  }

  try {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

export interface LoginResult {
  tokens: OAuthTokens;
}

export interface AuthorizationInfo {
  url: string;
  verifier: string;
}

export function generateAuthorizationUrl(): AuthorizationInfo {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const authUrl = new URL(OAUTH_CONFIG.authorizationUrl);
  authUrl.searchParams.set("code", "true");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", OAUTH_CONFIG.redirectUri);
  authUrl.searchParams.set("scope", OAUTH_CONFIG.scope);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", codeVerifier);

  return {
    url: authUrl.toString(),
    verifier: codeVerifier,
  };
}

export async function exchangeCode(
  code: string,
  verifier: string
): Promise<OAuthTokens> {
  const splits = code.split("#");
  const authCode = splits[0];
  const state = splits[1];

  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: authCode,
      state: state,
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const tokens: OAuthTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  await saveTokens(tokens);
  return tokens;
}

export async function login(
  openBrowser: (url: string) => void | Promise<void>,
  getCode: () => Promise<string>
): Promise<LoginResult> {
  const { url, verifier } = generateAuthorizationUrl();

  await openBrowser(url);

  const code = await getCode();
  const tokens = await exchangeCode(code.trim(), verifier);

  return { tokens };
}

export function isLoggedIn(): Promise<boolean> {
  return loadStoredTokens().then((tokens) => tokens !== null);
}
