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

const out = process.argv[2];
const ROUTES = process.argv.slice(3);
const browser = await chromium.launch();
const width = Number(process.env.W || 1440);
const context = await browser.newContext({
  storageState: STATE,
  viewport: { width, height: 900 },
});
const page = await context.newPage();

let text = "";
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`);
  await page.waitForTimeout(2500);
  text += `\n\n========== ${route} @${width} -> ${page.url()}\n`;
  text += (await page.locator("body").ariaSnapshot()) + "\n";
}
writeFileSync(out, text);
console.log("wrote", out, text.length);
await browser.close();
