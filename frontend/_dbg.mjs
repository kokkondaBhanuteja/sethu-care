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
          value: JSON.stringify({ role: "ADMIN", name: "Ravi Kumar", id: "adm_ravi" }),
        },
      ],
    },
  ],
};
const browser = await chromium.launch();
const context = await browser.newContext({ storageState: STATE, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${BASE}/bookings/B-8823/cancel`);
await page.waitForTimeout(2000);
const radios = page.getByRole("radio");
console.log("radio count:", await radios.count());
for (const r of await radios.all()) {
  const box = await r.boundingBox();
  console.log(JSON.stringify(await r.evaluate((e) => e.outerHTML)).slice(0, 120), "box=", JSON.stringify(box), "visible=", await r.isVisible());
}
console.log("byName:", await page.getByRole("radio", { name: "Duplicate booking" }).count());
await browser.close();
