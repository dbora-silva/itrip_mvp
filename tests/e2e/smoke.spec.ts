import { expect, test } from "@playwright/test";

/**
 * Installation smoke test only — confirms Playwright itself is wired up correctly
 * (config, baseURL, browser install) against the real Docker container. Deliberately
 * not authenticated and does not touch trips/login/CRUD: the actual E2E suite is built
 * separately, by hand, on top of this scaffold.
 */
test("home page loads", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Planeje hoje. Viaje melhor." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar conta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
});
