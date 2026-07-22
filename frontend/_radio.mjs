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
page.setDefaultTimeout(6000);

async function tryIt(label, fn) {
  try {
    await fn();
    console.log("OK  ", label);
  } catch (e) {
    console.log("FAIL", label, String(e).split("\n")[0]);
  }
}

await page.goto(`${BASE}/bookings/B-8790/refund`);
await page.waitForTimeout(2500);

const typeGroup = page.getByRole("group", { name: "Refund type" });
const reasonGroup = page.getByRole("group", { name: "Reason (required)" });

await tryIt("press space on 'Goodwill credit'", async () => {
  await typeGroup.getByRole("radio", { name: /^Goodwill credit/ }).press(" ");
  if (!(await typeGroup.getByRole("radio", { name: /^Goodwill credit/ }).isChecked())) throw new Error("not checked");
});

await tryIt("fill amount 900", async () => {
  await page.getByRole("spinbutton", { name: /Amount/ }).fill("900");
  await page.waitForTimeout(400);
});

await tryIt("press space on 'Goodwill / retention'", async () => {
  await reasonGroup.getByRole("radio", { name: /^Goodwill \/ retention/ }).press(" ");
  if (!(await reasonGroup.getByRole("radio", { name: /^Goodwill \/ retention/ }).isChecked())) throw new Error("not checked");
});

await tryIt("click label text 'Overcharged'", async () => {
  await reasonGroup.getByText("Overcharged", { exact: true }).click();
  if (!(await reasonGroup.getByRole("radio", { name: /^Overcharged/ }).isChecked())) throw new Error("not checked");
});

// suspend page: nested radiogroup inside group
await page.goto(`${BASE}/providers/PRV-882/suspend`);
await page.waitForTimeout(3000);
await tryIt("suspend: press space on 'Customer safety complaint'", async () => {
  const g = page.getByRole("group", { name: "Reason (required)" });
  await g.getByRole("radio", { name: /^Customer safety complaint/ }).press(" ");
  if (!(await g.getByRole("radio", { name: /^Customer safety complaint/ }).isChecked())) throw new Error("not checked");
});
await tryIt("suspend: checkbox-ish 'Let them finish' after continue", async () => {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(800);
  const jobs = page.getByRole("button", { name: "Let them finish" });
  const n = await jobs.count();
  for (let i = 0; i < n; i++) await jobs.nth(0).click();
  await page.waitForTimeout(500);
  console.log("     after resolve, continue disabled =", await page.getByRole("button", { name: "Continue" }).isDisabled());
});

await browser.close();
