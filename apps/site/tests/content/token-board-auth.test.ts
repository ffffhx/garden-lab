import { describe, expect, it } from "vitest";

import {
  createAgentSessionToken,
  createOAuthState,
  createWebSessionToken,
  identityFromGitHubUser,
  isGithubIdentityAllowed,
  sanitizeReturnTo,
  verifyAgentSessionToken,
  verifyOAuthState,
  verifyWebSessionToken,
} from "@garden-lab/token-board-core/auth";

describe("token board GitHub auth", () => {
  it("signs separate web and agent sessions", () => {
    const identity = identityFromGitHubUser({
      id: 123,
      login: "octo",
      name: "Octo Friend",
      avatar_url: "https://avatars.githubusercontent.com/u/123",
    });
    const webToken = createWebSessionToken(identity, "secret", 60);
    const agentToken = createAgentSessionToken(identity, "secret", 60);

    expect(verifyWebSessionToken(webToken, "secret")?.githubLogin).toBe("octo");
    expect(verifyAgentSessionToken(agentToken, "secret")?.userId).toBe("github:123");
    expect(verifyAgentSessionToken(webToken, "secret")).toBeUndefined();
  });

  it("protects OAuth state and return URLs", () => {
    const state = createOAuthState("https://board.example.com/token-leaderboard/", "secret", 60);

    expect(verifyOAuthState(state, "secret")?.returnTo).toBe("https://board.example.com/token-leaderboard/");
    expect(verifyOAuthState(`${state}x`, "secret")).toBeUndefined();
    expect(sanitizeReturnTo("https://evil.example.com/", ["https://board.example.com"], "/")).toBe("/");
    expect(sanitizeReturnTo("/token-leaderboard/", [], "/")).toBe("/token-leaderboard/");
  });

  it("supports optional GitHub login allowlists", () => {
    const identity = identityFromGitHubUser({ id: 123, login: "octo" });

    expect(isGithubIdentityAllowed(identity, [])).toBe(true);
    expect(isGithubIdentityAllowed(identity, ["octo"])).toBe(true);
    expect(isGithubIdentityAllowed(identity, ["someone-else"])).toBe(false);
  });
});
