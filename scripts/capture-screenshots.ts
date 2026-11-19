import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const shots = [
  { name: "wide-dark", width: 1440, height: 900, theme: "dark" },
  { name: "wide-light", width: 1440, height: 900, theme: "light" },
  { name: "narrow-dark", width: 375, height: 812, theme: "dark" },
  { name: "narrow-light", width: 375, height: 812, theme: "light" },
];

for (const s of shots) {
  const page = await browser.newPage();
  await page.setViewport({ width: s.width, height: s.height, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: s.theme as "dark" | "light" }]);
  await page.goto(process.env.EXPLORER_URL || "http://localhost:5173", { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForSelector("#tbody > tr", { timeout: 20000 });
  await page.waitForFunction(() => {
    const svg = document.querySelector("#capacity svg");
    return svg && svg.getBoundingClientRect().width > 100;
  }, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 400));
  const info = await page.evaluate(() => {
    const wide = [...document.querySelectorAll("*")]
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 8)
      .map((e) => ({ tag: e.tagName, cls: String(e.className).slice(0, 50), right: Math.round(e.getBoundingClientRect().right), w: Math.round(e.getBoundingClientRect().width) }));
    const svg = document.querySelector("#capacity svg");
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      height: document.documentElement.scrollHeight,
      rows: document.querySelectorAll("#tbody tr").length,
      chartW: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
      heatVisible: !!document.querySelector("#aspects svg"),
      tableVisible: !!document.querySelector("#tbody tr.model"),
      wide,
    };
  });
  await page.screenshot({ path: `${process.env.SHOT_DIR || "/tmp/opencode"}/${s.name}.png`, fullPage: true });
  console.log(s.name, JSON.stringify(info));
  await page.close();
}
await browser.close();
