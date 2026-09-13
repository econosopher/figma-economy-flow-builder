// Evaluate inside the approved Aside REPL. Uses fresh guest copies only.
async function runResearchedPresetChecks(page) {
  const names = ['Gossip Harbor', 'Royal Match', 'MONOPOLY GO!', 'World of Warcraft', 'Call of Duty: Warzone', 'Apex Legends'];
  const checks = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); checks.push(message); };
  const button = name => page.getByRole('button', {name, exact:true});
  const ready = async () => { await sleep(150); for(let i=0;i<100 && await page.locator('.layout-status').count();i++) await sleep(30); await snapshot(page); };
  const catalogReady = async () => { await sleep(220); for(let i=0;i<100;i++) { if(await page.locator('.preset-grid[aria-busy="false"]').count()) { await snapshot(page); return; } await sleep(30); } throw new Error('Catalog did not finish loading'); };
  await page.locator('.canvas-toolbar').waitFor();
  await snapshot(page);
  await button('Library').click(); await snapshot(page);
  await button('Presets').click(); await catalogReady();
  await page.getByRole('textbox',{name:'Search diagrams',exact:true}).fill(''); await catalogReady();
  check(await page.locator('.preset-card').count() === 7, 'exactly six games and the starter');
  const titles = await page.evaluate(() => Array.from(document.querySelectorAll('.preset-card h3'), el => el.textContent));
  check(JSON.stringify([...titles.slice(1)].sort()) === JSON.stringify([...names].sort()), 'chosen six games remain available');
  await page.getByRole('textbox',{name:'Search diagrams',exact:true}).fill('Mobile'); await catalogReady();
  check(await page.locator('.preset-card').count()===3, 'three mobile games are searchable');
  await page.getByRole('textbox',{name:'Search diagrams',exact:true}).fill('PC / console'); await catalogReady();
  check(await page.locator('.preset-card').count()===3, 'three PC and console games are searchable');
  await page.getByRole('textbox',{name:'Search diagrams',exact:true}).fill(''); await catalogReady();
  await snapshot(page);
  await button('Community').click(); await catalogReady();
  check(await page.locator('.preset-card').count()===7, 'community seeds use the same seven entries');
  await button('Presets').click(); await catalogReady();
  for (const name of names) {
    await page.getByRole('textbox',{name:'Search diagrams',exact:true}).fill(name); await catalogReady();
    await button(`Sources for ${name}`).click(); await snapshot(page);
    check((await page.locator('.research-source a').count())>=3, `${name}: source references visible`);
    check((await page.locator('.research-origin').textContent()).includes('not independently verified'), `${name}: original-evidence boundary visible`);
    await page.keyboard.press('Escape'); await snapshot(page);
    await button(`Open ${name}`).click(); await ready();
    await button('Edit JSON').click(); await snapshot(page);
    const d = JSON.parse(await page.evaluate(() => document.querySelector('[aria-label="Diagram JSON"]').value));
    check(d.id!==d.research.presetId && d.research.checkedAt==='2026-09-14', `${name}: editable copy retains evidence`);
    await page.keyboard.press('Escape'); await ready();
    check(await page.locator('.routing-issues').count()===0, `${name}: no routing issues`);
    await button('Sources').click(); await snapshot(page);
    check(await page.locator('.research-source a').count()===d.research.sources.length, `${name}: copied diagram exposes all sources`);
    await page.keyboard.press('Escape'); await snapshot(page);
    await button('Library').click(); await snapshot(page);
  }
  await page.keyboard.press('Escape'); await snapshot(page);
  await page.getByRole('textbox',{name:'Diagram title',exact:true}).fill('Research recovery check');
  await sleep(600); await page.reload(); await page.locator('.canvas-toolbar').waitFor(); await ready();
  check(await page.evaluate(() => document.querySelector('[aria-label="Diagram title"]').value)==='Research recovery check', 'copy edits survive reload');
  await button('Sources').click(); await snapshot(page);
  check(await page.locator('.research-source a').count()===3, 'source metadata survives reload');
  await page.keyboard.press('Escape');
  console.log({passed:checks.length,checks});
  return checks;
}
