// Run in approved Aside REPL against an isolated starter copy.
async function checkGecRelease(page) {
  const checks = [];
  async function count(selector, expected, name) {
    const until = Date.now() + 5000;
    while ((await page.locator(selector).count()) !== expected) {
      if (Date.now() > until)
        throw new Error(
          name + ": unexpected count " + (await page.locator(selector).count()),
        );
      await sleep(30);
    }
    checks.push(name);
  }
  const card = (id) =>
    page.locator('.react-flow__node-card[data-id="' + id + '"]');
  await card("mastery").hover();
  await count(
    ".react-flow__edge.investment-path",
    7,
    "hover traces both investment branches",
  );
  await count(".economy-card.investment-path", 8, "upstream boxes highlight");
  await card("mastery").click({ position: { x: 5, y: 5 } });
  await page.getByRole("button", { name: "Research", exact: true }).hover();
  await count(
    ".react-flow__edge.investment-path",
    7,
    "click persists after leaving",
  );
  await card("play").hover();
  await count(
    ".react-flow__edge.investment-path",
    1,
    "hover previews another box",
  );
  await page.getByRole("button", { name: "Research", exact: true }).hover();
  await count(
    ".react-flow__edge.investment-path",
    7,
    "leaving restores selected path",
  );
  await page.locator(".react-flow__pane").click({ position: { x: 15, y: 20 } });
  await count(
    ".react-flow__edge.investment-path",
    0,
    "empty canvas clears selection",
  );
  await page
    .locator(
      '.react-flow__node-card[data-id="play"] button[aria-label="Card options"]',
    )
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("combobox", { name: "Connect to", exact: true })
    .waitFor();
  checks.push("keyboard-accessible Connect to picker");
  await page.keyboard.press("Escape");
  return checks;
}
