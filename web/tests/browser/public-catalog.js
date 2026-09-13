// Run in the approved Aside REPL on a disposable local/staging tab.
async function runPublicCatalogChecks(page) {
  const checks = [];
  const check = (ok, label) => {
    if (!ok) throw new Error(label);
    checks.push(label);
  };
  const button = (name) => page.getByRole("button", { name, exact: true });
  const ready = async () => {
    for (let i = 0; i < 100; i++) {
      if (await page.locator('.preset-grid[aria-busy="false"]').count()) {
        await snapshot(page);
        return;
      }
      await sleep(30);
    }
    throw new Error("Catalog did not finish loading");
  };
  await page.locator(".canvas-toolbar").waitFor();
  await snapshot(page);
  if (
    !(await page
      .getByRole("combobox", { name: "Sort public diagrams" })
      .count())
  ) {
    await button("Library").click();
    await snapshot(page);
  }
  await button("Presets").click();
  await ready();
  check(
    (await page.evaluate(
      () => document.querySelector('[aria-label="Sort public diagrams"]').value,
    )) === "most_viewed",
    "Most viewed is the default",
  );
  const titles = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(".preset-info h3"),
      (element) => element.textContent,
    ),
  );
  check(titles[0] === "The everyday economy", "Starter is pinned");
  check(titles.length === 7, "Six bundled games remain available");
  check(
    await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("button")).find(
          (element) => element.textContent === "Next",
        ).disabled,
    ),
    "Pagination ends at the catalog boundary",
  );
  const search = page.getByRole("textbox", { name: "Search diagrams" });
  await search.fill("Mobile");
  await sleep(220);
  await ready();
  check(
    (await page.locator(".preset-card").count()) === 3,
    "Mobile category search finds three presets",
  );
  await search.fill("PC / console");
  await sleep(220);
  await ready();
  check(
    (await page.locator(".preset-card").count()) === 3,
    "Console category search finds three presets",
  );
  await search.fill("Apex");
  await sleep(220);
  await ready();
  check(
    (await page.locator(".preset-card").count()) === 1,
    "Search filters public diagrams",
  );
  await search.click();
  await page.keyboard.press("Tab");
  check(
    (await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    )) === "Sort public diagrams",
    "Sort is reachable with the keyboard",
  );
  await page
    .getByRole("combobox", { name: "Sort public diagrams" })
    .selectOption("newest");
  await sleep(220);
  await ready();
  check(
    (await page.evaluate(
      () => document.querySelector('[aria-label="Sort public diagrams"]').value,
    )) === "newest",
    "Sort selection updates the catalog",
  );
  await search.fill("");
  await button("Community").click();
  await sleep(220);
  await ready();
  check(
    (await page.locator(".preset-card").count()) === 7,
    "Community uses the same public catalog",
  );
  await button("Open Apex Legends").click();
  check(
    (
      await page.evaluate(
        () => document.querySelector('[aria-label="Diagram title"]').value,
      )
    ).includes("Apex Legends"),
    "A preset opens as an editable copy",
  );
  await sleep(650);
  await page.reload();
  await page.locator(".canvas-toolbar").waitFor();
  await snapshot(page);
  check(
    (
      await page.evaluate(
        () => document.querySelector('[aria-label="Diagram title"]').value,
      )
    ).includes("Apex Legends"),
    "Preset copy survives reload",
  );
  console.log({ passed: checks.length, checks });
  return checks;
}
