import { expect, test } from "@playwright/test";

test.describe("navegação do agendamento", () => {
  test("volta para Agendar pelo menu hamburger no mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/agendar/meus-agendamentos");

    const navigation = page.getByRole("navigation", {
      name: "Navegação do agendamento",
    });
    await expect(navigation).toBeVisible({ timeout: 15000 });

    const menuTrigger = page.getByTestId("mobile-menu-trigger");
    await expect(menuTrigger).toBeVisible({ timeout: 15000 });
    await menuTrigger.click();

    const mobileMenu = page.getByTestId("mobile-menu");
    const agendarLink = mobileMenu.getByTestId("agendar-link");
    await expect(agendarLink).toHaveAttribute("href", "/agendar");

    await agendarLink.click();

    await expect(page).toHaveURL(/\/agendar$/);
  });

  test("mantém os destinos visíveis no header desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/agendar/meus-agendamentos");

    const navigation = page.getByRole("navigation", {
      name: "Navegação do agendamento",
    });
    await expect(navigation).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="mobile-menu-trigger"]')).toBeHidden();
    await expect(page.getByTestId("agendar-link")).toHaveAttribute(
      "href",
      "/agendar"
    );
  });
});
