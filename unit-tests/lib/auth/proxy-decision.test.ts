import { describe, expect, it } from "vitest";
import { decideProxyAction } from "@/lib/auth/proxy-decision";

describe("decideProxyAction", () => {
  it("passes through an unauthenticated visit to a public page", () => {
    expect(decideProxyAction("/", false)).toEqual({ action: "next" });
  });

  it("redirects an unauthenticated visit to /dashboard, to /login with next", () => {
    expect(decideProxyAction("/dashboard", false)).toEqual({
      action: "redirect",
      to: "/login?next=%2Fdashboard",
    });
  });

  it("redirects an unauthenticated visit to a /dashboard subroute, preserving it as next", () => {
    expect(decideProxyAction("/dashboard/trips", false)).toEqual({
      action: "redirect",
      to: "/login?next=%2Fdashboard%2Ftrips",
    });
  });

  it("passes through an authenticated visit to /dashboard", () => {
    expect(decideProxyAction("/dashboard", true)).toEqual({ action: "next" });
  });

  it("redirects an authenticated visit to /login, to /dashboard", () => {
    expect(decideProxyAction("/login", true)).toEqual({ action: "redirect", to: "/dashboard" });
  });

  it("redirects an authenticated visit to /cadastro, to /dashboard", () => {
    expect(decideProxyAction("/cadastro", true)).toEqual({ action: "redirect", to: "/dashboard" });
  });

  it("passes through an unauthenticated visit to /login (no loop)", () => {
    expect(decideProxyAction("/login", false)).toEqual({ action: "next" });
  });

  it("passes through an unauthenticated visit to /cadastro (no loop)", () => {
    expect(decideProxyAction("/cadastro", false)).toEqual({ action: "next" });
  });

  it("never produces a redirect target that itself redirects again", () => {
    // Every redirect this function can produce lands on either /login (with or without
    // a next param) or /dashboard. Re-running the decision against those exact
    // destinations, with the authentication state that triggered the redirect in the
    // first place, must always be "next" — otherwise a loop would be possible.
    const unauthenticatedRedirect = decideProxyAction("/dashboard", false);
    if (unauthenticatedRedirect.action === "redirect") {
      const destinationPath = new URL(unauthenticatedRedirect.to, "https://itrip.local").pathname;
      expect(decideProxyAction(destinationPath, false)).toEqual({ action: "next" });
    }

    const authenticatedRedirect = decideProxyAction("/login", true);
    if (authenticatedRedirect.action === "redirect") {
      expect(decideProxyAction(authenticatedRedirect.to, true)).toEqual({ action: "next" });
    }
  });
});
