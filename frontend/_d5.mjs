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
          value: JSON.stringify({ role: "ADMIN", name: "Ravi Kumar", id: "adm_ravi" }),
        },
      ],
    },
  ],
};
const ROUTES = process.argv.slice(3);
const browser = await chromium.launch();
const width = Number(process.env.W || 1440);
const context = await browser.newContext({ storageState: STATE, viewport: { width, height: 900 } });
const page = await context.newPage();
let log = "";
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`);
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const sections = document.querySelector('nav[aria-label="Sections"]');
    return {
      crumbs: sections ? (sections.textContent || "").trim() : null,
      title: document.querySelector(".topbar__title")?.textContent?.trim() ?? null,
      appbar: document.querySelector(".appbar__title")?.textContent?.trim() ?? null,
      emptyTitles: [...document.querySelectorAll(".empty__title")].map((e) => e.textContent?.trim()),
    };
  });
  log += `\n### ${route} -> ${page.url()} @${width}\n  ${JSON.stringify(info)}\n`;
}
writeFileSync(process.argv[2], log);
console.log(log);
await browser.close();
