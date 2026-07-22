import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:4175";
const STATE = {
  cookies: [],
  origins: [
    {
      origin: BASE,
      localStorage: [
        { name: "sethu.jwt", value: "mock.admin.token" },
        {
          name: "sethu.user",
          value: JSON.stringify({
            role: "ADMIN",
            name: "Ravi Kumar",
            id: "adm_ravi",
            email: "ravi@setucare.in",
          }),
        },
      ],
    },
  ],
};

const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
let log = "";
const snap = async (label) => {
  log += `\n\n===== ${label} (${page.url()})\n`;
  log += await page.locator("body").ariaSnapshot();
};

// ---------- CANCEL ----------
await page.goto(`${BASE}/bookings/B-8823/cancel`);
await page.waitForTimeout(1500);
await page.getByRole("radio", { name: "Duplicate booking" }).check({ force: true });
await page.getByRole("button", { name: "Continue to confirm" }).click();
await page.waitForTimeout(800);
await snap("cancel: after continue to confirm");

// try the confirm
const confirmBtn = page.getByRole("button", { name: /Confirm|Verify/ }).last();
if (await confirmBtn.isVisible().catch(() => false)) {
  await confirmBtn.click();
  await page.waitForTimeout(1200);
  await snap("cancel: after confirm click");
}

// ---------- REFUND goodwill cap ----------
await page.goto(`${BASE}/bookings/B-8790/refund`);
await page.waitForTimeout(1200);
await page.getByRole("radio", { name: /Goodwill credit/ }).check({ force: true });
await page.getByRole("spinbutton", { name: /Amount/ }).fill("900");
await page.getByRole("radio", { name: "Goodwill / retention" }).check({ force: true });
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Continue to confirm" }).click();
await page.waitForTimeout(800);
await snap("refund: goodwill 900 continue");

// ---------- SUSPEND ----------
await page.goto(`${BASE}/providers/PRV-882/suspend`);
await page.waitForTimeout(1200);
await page.getByRole("radio", { name: /Customer safety complaint/ }).check({ force: true });
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForTimeout(800);
await snap("suspend: step 2");

writeFileSync("d_walk.txt", log);
console.log("ok", log.length);
await browser.close();
