import { describe, expect, it } from "vitest";
import { formatAiGatewayError } from "./formatAiGatewayError";
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
});

describe("MODELS aliases", () => {
  it("HAIKU and SONNET cannot drift off the models this account already reaches", () => {
    expect(MODELS.HAIKU).toBe(MODELS.TEXT_FALLBACK);
    expect(MODELS.SONNET).toBe(MODELS.VISION_FALLBACK);
    expect(MODELS.HAIKU).toBe("anthropic/claude-3-haiku");
    expect(MODELS.SONNET).toBe("anthropic/claude-3-5-sonnet");
    expect(MODELS.TEXT_PRIMARY).not.toBe(MODELS.HAIKU);
    expect(MODELS.SONNET).not.toBe(MODELS.HAIKU);
  });
});
