// Evaluate in the approved Aside REPL against a disposable guest preset copy.
async function runVisibilityChecks(page) {
  const passed=[];
  const check=(ok,label)=>{if(!ok)throw new Error(label);passed.push(label);};
  const button=name=>page.getByRole('button',{name,exact:true});
  await page.locator('.canvas-toolbar').waitFor(); await snapshot(page);
  check((await page.getByRole('link',{name:'Source code on GitHub',exact:true}).getAttribute('href'))==='https://github.com/econosopher/figma-economy-flow-builder','GitHub source link');
  await button('Library').click(); await snapshot(page);
  await page.getByRole('textbox',{name:'Search diagrams',exact:true}).fill('everyday'); await snapshot(page);
  await button('Open The everyday economy').click(); await sleep(400); await snapshot(page);
  check((await button('Make diagram private').textContent()).includes('local only'),'new guest copy is public-intent but explicitly local');
  await page.getByRole('textbox',{name:'Diagram title',exact:true}).fill('Visibility recovery check'); await sleep(350);
  await button('Make diagram private').click(); await sleep(500); await snapshot(page);
  check((await button('Make diagram public').textContent()).includes('Private'),'lock makes diagram private');
  await button('Undo').click(); await sleep(200); await snapshot(page);
  check(await button('Make diagram public').count()===1,'canvas undo cannot unlock a private diagram');
  await button('Edit JSON').click(); await snapshot(page);
  const d=JSON.parse(await page.getByRole('textbox',{name:'Diagram JSON',exact:true}).inputValue());
  check(d.visibility==='private','private preference preserved in JSON');
  await page.keyboard.press('Escape'); await sleep(500); await page.reload(); await page.locator('.canvas-toolbar').waitFor(); await snapshot(page);
  check(await button('Make diagram public').count()===1,'private preference survives reload');
  await button('Make diagram public').click(); await sleep(500); await snapshot(page);
  check((await button('Make diagram private').textContent()).includes('local only'),'unlock returns to local public preference without claiming upload');
  await button('Make diagram private').click(); await sleep(500);
  console.log({passed:passed.length,checks:passed}); return passed;
}
