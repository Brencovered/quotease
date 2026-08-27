import { describe, expect, it } from "vitest";
import { aiGatewayHttpStatus, formatAiGatewayError, isGatewayRateLimitError } from "./formatAiGatewayError";
import { MODELS } from "./gateway";

describe("formatAiGatewayError", () => {
  it("maps free-tier model 403s to actionable copy", () => {
    const err = Object.assign(new Error("Free tier users do not have access to this model"), {
      statusCode: 403,
    });
    expect(formatAiGatewayError(err)).toMatch(/cannot use the requested model/i);
  });

  it("maps gateway auth failures", () => {
    expect(formatAiGatewayError(new Error("Unauthenticated request to AI Gateway"))).toMatch(
      /AI_GATEWAY_API_KEY/
    );
  });

  it("maps credit / billing failures", () => {
    expect(formatAiGatewayError(new Error("insufficient credits"))).toMatch(/no credits/i);
  });

  it("maps incomplete structured output", () => {
    const err = Object.assign(new Error("No object generated"), { name: "NoObjectGeneratedError" });
    expect(formatAiGatewayError(err)).toMatch(/incomplete outline/i);
  });

  it("maps Gateway free-tier 429s nested inside RetryError", () => {
    const lastError = Object.assign(
      new Error("Free tier requests on this model are rate-limited. Upgrade to paid credits at https://vercel.com/d"),
      { name: "GatewayRateLimitError", statusCode: 429, type: "rate_limit_exceeded" },
    );
    const retry = Object.assign(
      new Error(`Failed after 3 attempts. Last error: ${lastError.message}`),
      { name: "AI_RetryError", reason: "maxRetriesExceeded", lastError, errors: [lastError] },
    );
    expect(formatAiGatewayError(retry)).toMatch(/rate-limiting this model/i);
    expect(formatAiGatewayError(retry)).toMatch(/top up/i);
    expect(aiGatewayHttpStatus(retry)).toBe(429);
    expect(isGatewayRateLimitError(retry)).toBe(true);
  });
});

describe("MODELS aliases", () => {
  it("HAIKU and SONNET cannot drift off the models this account already reaches", () => {
    expect(MODELS.HAIKU).toBe(MODELS.TEXT_FALLBACK);
    expect(MODELS.SONNET).toBe(MODELS.VISION_FALLBACK);
    expect(MODELS.HAIKU).toBe("anthropic/claude-3-haiku");
    expect(MODELS.SONNET).toBe("anthropic/claude-3-5-sonnet");
    expect(MODELS.TEXT_PRIMARY).not.toBe(MODELS.HAIKU);
    expect(MODELS.SONNET).not.toBe(MODELS.HAIKU);
    expect(MODELS.TEXT_FLASH).toBe("google/gemini-2.5-flash-lite");
  });
});
