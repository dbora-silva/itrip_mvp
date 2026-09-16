import { test } from "@playwright/test";

import { LoginPage } from "../components/login/login";

let loginPage: LoginPage;

test.beforeEach(async ({ page }) => {
  loginPage = new LoginPage(page);
  await loginPage.goto();
});

test("should login successfully with valid credentials", async () => {
  await loginPage.fillEmail("debora@example.test");
  await loginPage.fillPassword("ItripLocal123!");
  await loginPage.clickSubmit();

  await loginPage.expectToHaveURL("/dashboard");
});

test("should show error message with invalid credentials", async () => {
  await loginPage.fillEmail("invalid@example.com");
  await loginPage.fillPassword("wrongpassword");
  await loginPage.clickSubmit();

  await loginPage.expectErrorMessage("E-mail ou senha inválidos.");
});
