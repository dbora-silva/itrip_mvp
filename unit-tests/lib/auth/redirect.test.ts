import { describe, expect, it } from "vitest";
import { buildLoginRedirectUrl, resolvePostLoginRedirect } from "@/lib/auth/redirect";

describe("resolvePostLoginRedirect", () => {
  it("accepts /dashboard", () => {
    expect(resolvePostLoginRedirect("/dashboard")).toBe("/dashboard");
  });

  it("accepts a subroute of /dashboard", () => {
    expect(resolvePostLoginRedirect("/dashboard/trips")).toBe("/dashboard/trips");
  });

  it("falls back to /dashboard when next is null", () => {
    expect(resolvePostLoginRedirect(null)).toBe("/dashboard");
  });

  it("falls back to /dashboard when next is empty", () => {
    expect(resolvePostLoginRedirect("")).toBe("/dashboard");
  });

  it("rejects an absolute external URL", () => {
    expect(resolvePostLoginRedirect("https://evil.com/dashboard")).toBe("/dashboard");
  });

  it("rejects a protocol-relative URL", () => {
    expect(resolvePostLoginRedirect("//evil.com/dashboard")).toBe("/dashboard");
  });

  it("rejects a backslash-based host smuggling attempt", () => {
    expect(resolvePostLoginRedirect("/\\evil.com")).toBe("/dashboard");
  });

  it("rejects a javascript: URL", () => {
    expect(resolvePostLoginRedirect("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects a percent-encoded traversal attempt", () => {
    expect(resolvePostLoginRedirect("/dashboard/%2e%2e/%2e%2e/evil")).toBe("/dashboard");
  });

  it("rejects a value containing a literal control character", () => {
    const withControlChar = "/dashboard" + String.fromCharCode(0) + "x";
    expect(resolvePostLoginRedirect(withControlChar)).toBe("/dashboard");
  });

  it("rejects a path segment with a space", () => {
    expect(resolvePostLoginRedirect("/dashboard /x")).toBe("/dashboard");
  });

  it("rejects /login as a destination", () => {
    expect(resolvePostLoginRedirect("/login")).toBe("/dashboard");
  });

  it("rejects /cadastro as a destination", () => {
    expect(resolvePostLoginRedirect("/cadastro")).toBe("/dashboard");
  });

  it("rejects an unrelated public route", () => {
    expect(resolvePostLoginRedirect("/")).toBe("/dashboard");
  });

  it("rejects a path that only starts with /dashboard as a prefix, without a separator", () => {
    expect(resolvePostLoginRedirect("/dashboardevil.com")).toBe("/dashboard");
  });
});

describe("buildLoginRedirectUrl", () => {
  it("builds /login?next=<encoded path> using URLSearchParams", () => {
    expect(buildLoginRedirectUrl("/dashboard")).toBe("/login?next=%2Fdashboard");
  });
});
