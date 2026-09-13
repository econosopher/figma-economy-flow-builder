// Load this function into the approved Aside REPL, then call runDirectCanvasSmoke(page).
// Creates an isolated guest copy of the bundled starter. Does not use account services.
async function runDirectCanvasSmoke(page) {
  await page.locator(".canvas-toolbar").waitFor();
  await snapshot(page);
  const passed = [];
  const check = (value, label) => {
    if (!value) throw new Error(label);
    passed.push(label);
  };
  const button = (name) => page.getByRole("button", { name, exact: true });
  async function until(test) {
    const end = Date.now() + 10000;
    while (!(await test())) {
      if (Date.now() > end) throw new Error("UI did not settle");
      await sleep(40);
    }
  }
  async function ready() {
    await sleep(100);
    await until(async () => !(await page.locator(".layout-status").count()));
    await snapshot(page);
  }
  await button("Library").click();
  await snapshot(page);
  await page
    .getByRole("textbox", { name: "Search diagrams", exact: true })
    .fill("everyday");
  await page.locator(".preset-card").first().click();
  await ready();
  await sleep(350); // The deliberate fit animation runs only when opening a diagram.
  check(
    (await page.locator(".react-flow__node-card").count()) === 8,
    "starter copy loads",
  );
  const viewport = await page
    .locator(".react-flow__viewport")
    .getAttribute("style");
  await page.locator('.react-flow__node-card[data-id="play"]').focus();
  await page.keyboard.press("Enter");
  await snapshot(page);
  await page
    .locator('textarea[aria-label="Card title"]')
    .fill("A daily mission");
  await page.keyboard.press("Enter");
  await ready();
  check(
    (
      await page.locator('.react-flow__node-card[data-id="play"]').textContent()
    ).includes("A daily mission"),
    "keyboard inline title edit",
  );
  check(
    (await page.locator(".inspector").count()) === 0,
    "selection never opens the inspector",
  );
  await page
    .locator('.react-flow__node-card[data-id="play"] .inline-hit')
    .first()
    .click();
  await snapshot(page);
  await page
    .locator('textarea[aria-label="Card title"]')
    .fill("Cancelled title");
  await page.keyboard.press("Escape");
  await ready();
  check(
    !(
      await page.locator('.react-flow__node-card[data-id="play"]').textContent()
    ).includes("Cancelled title"),
    "Escape cancels inline edits",
  );
  const add = page.locator(
    '.react-flow__node-card[data-id="time"] .resource-plus',
  );
  await add.click();
  await snapshot(page);
  await page.locator('[data-resource-choice="0"]').click();
  await ready();
  await page.locator('textarea[aria-label="source 1"]').fill("Test coins");
  await page.keyboard.press("Enter");
  await ready();
  check(
    (
      await page.locator('.react-flow__node-card[data-id="time"]').textContent()
    ).includes("Test coins"),
    "click resource menu adds an editable row",
  );
  let box = await add.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await snapshot(page);
  const choice = await page.locator('[data-resource-choice="2"]').boundingBox();
  await page.mouse.move(choice.x + 40, choice.y + choice.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await ready();
  check(
    (await page.locator('textarea[aria-label="value 1"]').count()) === 1,
    "press-drag-release selects the highlighted resource",
  );
  await page.locator('textarea[aria-label="value 1"]').fill("Effort");
  await page.keyboard.press("Enter");
  await ready();
  box = await add.boundingBox();
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x - 70, box.y + 15, { steps: 6 });
  await page.mouse.up();
  await ready();
  check(
    (await page.locator("[data-resource-choice]").count()) === 0,
    "releasing outside the gesture menu cancels",
  );
  await add.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await ready();
  check(
    (await page.locator('textarea[aria-label="sink 2"]').count()) === 1,
    "resource menu supports keyboard selection",
  );
  await page.keyboard.press("Escape");
  await button("Open resources").click();
  await snapshot(page);
  check(
    (await page.locator(".react-flow__viewport").getAttribute("style")) ===
      viewport,
    "resource drawer does not move the viewport",
  );
  const start = await button("Equipment").boundingBox();
  const target = await page
    .locator('.react-flow__node-card[data-id="time"]')
    .boundingBox();
  await page.mouse.move(start.x + 45, start.y + 10);
  await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y + 10, { steps: 3 });
  await page.mouse.move(target.x + 60, target.y + 30, { steps: 12 });
  check(
    (await page.locator(".resource-drop-target").count()) === 1,
    "resource drag highlights its destination",
  );
  await page.mouse.up();
  await ready();
  check(
    (
      await page.locator('.react-flow__node-card[data-id="time"]').textContent()
    ).includes("Equipment"),
    "drawer drop adds the resource to the target",
  );
  await button("Close resources").click();
  await page
    .locator('.react-flow__node-card[data-id="time"] .action-plus')
    .click();
  await ready();
  check(
    (await page.locator('textarea[aria-label="Card title"]').count()) === 1,
    "connected creation focuses the new title",
  );
  await page
    .locator('textarea[aria-label="Card title"]')
    .fill("New connected action");
  await page.keyboard.press("Enter");
  await ready();
  const newId = await page
    .getByRole("group", { name: "New connected action", exact: true })
    .getAttribute("data-id");
  check(
    (await page.locator(".react-flow__node-card").count()) === 9 &&
      (await page.locator(".react-flow__edge").count()) === 9,
    "side plus creates one card and one connection",
  );
  await page
    .locator(`.react-flow__node-card[data-id="${newId}"] .action-minus`)
    .click();
  await ready();
  check(
    (await page.locator(".react-flow__node-card").count()) === 8 &&
      (await page.locator(".react-flow__edge").count()) === 8,
    "minus removes the card and its pipe together",
  );
  await button("Undo").click();
  await ready();
  check(
    (
      await page
        .locator(`.react-flow__node-card[data-id="${newId}"]`)
        .textContent()
    ).includes("New connected action"),
    "undo restores the named card and its pipe",
  );
  check(
    (await page.locator('textarea[aria-label="Card title"]').count()) === 0,
    "undo does not reopen the creation editor",
  );
  const oldPosition = await page
    .locator('.react-flow__node-card[data-id="premium"]')
    .evaluate((e) => e.style.transform);
  await page.evaluate(() => {
    window.flowDropFrames = [];
    document.addEventListener(
      "pointerup",
      () => {
        const start = performance.now();
        const sample = () => {
          window.flowDropFrames.push(
            document.querySelector('.react-flow__node-card[data-id="premium"]')
              ?.style.transform,
          );
          if (performance.now() - start < 600) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      { once: true },
    );
  });
  let grip = await page
    .locator('.react-flow__node-card[data-id="premium"] .card-grip')
    .boundingBox();
  let destination = await page
    .locator('.react-flow__node-card[data-id="play"]')
    .boundingBox();
  await page.mouse.move(grip.x + 5, grip.y + 5);
  await page.mouse.down();
  await page.mouse.move(grip.x + 5, destination.y + 65, { steps: 10 });
  await until(async () => (await page.locator(".drop-preview").count()) === 1);
  check(
    (await page.locator(".drop-preview").textContent()) === "Move here",
    "drag offers a measured valid placement preview",
  );
  await page.mouse.up();
  await ready();
  await sleep(650);
  const frames = await page.evaluate(() => window.flowDropFrames);
  check(
    frames.length > 10 && !frames.includes(oldPosition),
    "no frame after drop returns to the old card position",
  );
  check(
    await page.evaluate(() =>
      [...document.querySelectorAll(".react-flow__node")].every(
        (e) => getComputedStyle(e).visibility === "visible",
      ),
    ),
    "measured nodes remain visible after editing and dragging",
  );
  // Two immediate moves exercise replacement of a pending worker placement.
  for (const targetId of ["money", "play"]) {
    grip = await page
      .locator('.react-flow__node-card[data-id="premium"] .card-grip')
      .boundingBox();
    destination = await page
      .locator(`.react-flow__node-card[data-id="${targetId}"]`)
      .boundingBox();
    await page.mouse.move(grip.x + 5, grip.y + 5);
    await page.mouse.down();
    await page.mouse.move(grip.x + 5, destination.y + 60, { steps: 3 });
    await page.mouse.up();
  }
  await ready();
  check(
    (await page.locator(".drop-preview").count()) === 0 &&
      (await page.locator(".routing-issues").count()) === 0,
    "rapid consecutive drags settle without stale previews or routing errors",
  );
  await button("Share").click();
  await snapshot(page);
  await until(
    async () =>
      (await page.locator('img[alt="Exact PNG sharing preview"]').count()) ===
      1,
  );
  await until(
    async () =>
      await page
        .locator('img[alt="Exact PNG sharing preview"]')
        .evaluate((e) => e.complete && e.naturalWidth > 0),
  );
  check(
    await page
      .locator('img[alt="Exact PNG sharing preview"]')
      .evaluate((e) => e.naturalWidth > 1000),
    "full diagram PNG renders at export resolution",
  );
  await page.keyboard.press("Escape");
  await ready();
  await sleep(600);
  await page.reload();
  await ready();
  check(
    (
      await page.locator('.react-flow__node-card[data-id="time"]').textContent()
    ).includes("Equipment"),
    "local reload recovers direct edits",
  );
  console.log({ passed: passed.length, checks: passed });
  return passed;
}
