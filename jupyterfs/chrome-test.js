const assert = require('assert');
const puppeteer = require('puppeteer');
const inspect = require('util').inspect;
const URL = process.argv[2];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testJupyterfsExtension(html) {
  // Test FileTree sidebar widgets are present
  assert(await html.includes('title="osfs-here'), 'Could not find osfs-here FileTree in sidebar.');
  console.info('FileTree found for "osfs-here"')
}

async function main() {
  /* eslint-disable no-console */
  console.info('Starting Chrome Headless');

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  console.info('Navigating to page:', URL);
  await page.goto(URL);
  console.info('Waiting for page to load...');

  // Wait for the local file to redirect on notebook >= 6.0
  await page.waitForNavigation();

  const html = await page.content();
  if (inspect(html).indexOf('jupyter-config-data') === -1) {
    console.error('Error loading JupyterLab page:');
    console.error(html);
  }

  const el = await page.waitForSelector('#browserTest', { timeout: 100000 });
  console.log('Waiting for application to start...');
  let testError = null;

  try {
    await page.waitForSelector('.completed');
  } catch (e) {
    testError = e;
  }
  const textContent = await el.getProperty('textContent');
  const errors = JSON.parse(await textContent.jsonValue());

  for (let error of errors) {
    console.error(`Parsed an error from text content: ${error.message}`, error);
  }

  const loadedHtml = await page.content();
  await testJupyterfsExtension(loadedHtml);

  // wait to finalize any outstanding GET requests
  await sleep(1000);

  await browser.close();

  if (testError) {
    throw testError;
  }
  console.info('Chrome test complete');
}

// Stop the process if an error is raised in the async function.
process.on('unhandledRejection', up => {
  throw up;
});

main();
