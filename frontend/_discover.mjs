import { chromium } from "@playwright/test";

const BASE = "http://localhost:4175";

const ROUTES = [
  "/live",
  "/live/attention",
  "/live/map",
  "/bookings",
  "/bookings/B-8823",
  "/bookings/B-8823/assign",
  "/bookings/B-8823/cancel",
  "/bookings/B-8823/redispatch",
  "/bookings/B-8823/manual-complete",
  "/bookings/B-8790/refund",
  "/providers",
  "/providers/PRV-882",
  "/providers/PRV-882/suspend",
  "/providers/applications",
  "/providers/applications/APP-4471",
  "/alerts",
  "/alerts/ALT-1",
  "/more",
  "/customers",
  "/tickets",
  "/analytics",
  "/audit",
  "/settings/notifications",
  "/settings/security",
  "/profile",
  "/support",
  "/services",
  "/pricing",
  "/payouts",
  "/reports",
  "/settings/platform",
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// --- login ---
await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill("ops@setucare.in");
await page.getByLabel("Password").fill("password123");
await page.getByRole("button", { name: "Continue" }).click();
await page.waitForURL("**/login/otp");
const cells = page.getByRole("textbox", { name: /6-digit verification code \d/ });
for (let i = 0; i < 6; i++) await cells.nth(i).pressSequentially("123456"[i]);
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 10000 });
console.log("LOGIN OK ->", page.url());

const state = await context.storageState();
console.log("STORAGE:", JSON.stringify(state.origins));

const results = [];
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`);
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const headings = [...document.querySelectorAll("h1,h2,h3")].map(
      (h) => `${h.tagName}:${(h.textContent || "").trim().slice(0, 70)}`,
    );
    return { headings, url: location.pathname + location.search };
  });
  results.push({ route, ...info });
  console.log(`\n### ${route}  -> ${info.url}`);
  console.log(info.headings.join("\n"));
}

await browser.close();
