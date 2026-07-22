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
  const info = await page.evaluate(() => ({
    headings: [...document.querySelectorAll("h1,h2,h3")].map(
      (h) => `${h.tagName}:${(h.textContent || "").trim().slice(0, 60)}`,
    ),
    crumbs: [...document.querySelectorAll("nav[aria-label] span")]
      .map((s) => s.textContent?.trim())
      .filter(Boolean)
      .slice(0, 8),
    dialogs: [...document.querySelectorAll("[role=dialog]")].map((d) =>
      (d.querySelector(".modal__title, .drawer__head span")?.textContent || "").trim(),
    ),
  }));
  log += `\n### ${route} -> ${page.url()} @${width}\n  H: ${JSON.stringify(info.headings)}\n  C: ${JSON.stringify(info.crumbs)}\n  D: ${JSON.stringify(info.dialogs)}\n`;
}
writeFileSync(process.argv[2], log);
console.log(log);
await browser.close();
