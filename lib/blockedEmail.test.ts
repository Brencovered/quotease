import { describe, expect, it } from "vitest";
import { BLOCKED_EMAIL_MESSAGE, signupErrorMessage } from "./blockedEmail";

describe("signupErrorMessage", () => {
  it("shows the blocked message for a well formed address Supabase calls invalid", () => {
    expect(signupErrorMessage("Unable to validate email address: invalid format", "test@stayboba.com")).toBe(BLOCKED_EMAIL_MESSAGE);
  });
  it("shows the blocked message for the trigger's database error", () => {
    expect(signupErrorMessage("Database error saving new user", "a@b.com")).toBe(BLOCKED_EMAIL_MESSAGE);
  });
  it("keeps Supabase's message for a genuinely malformed address", () => {
    expect(signupErrorMessage("Unable to validate email address: invalid format", "not-an-email")).toBe("Unable to validate email address: invalid format");
  });
  it("leaves unrelated errors alone", () => {
    expect(signupErrorMessage("User already registered", "a@b.com")).toBe("User already registered");
  });
});
