const assert = require('assert');
const inspect = require('util').inspect;
const playwright = require('playwright');

const URL = process.argv[2];
const BROWSER_VAR = 'JLAB_BROWSER_TYPE';
const BROWSER = process.env[BROWSER_VAR] || 'chromium';
const OUTPUT_VAR = 'JLAB_BROWSER_CHECK_OUTPUT';
const OUTPUT = process.env[OUTPUT_VAR];

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
  console.info(`Starting headless ${BROWSER}...`);

  const pwBrowser = playwright[BROWSER];
  const browser = await pwBrowser.launch({
    logger: {
      isEnabled: () => !!OUTPUT,
      log: (name, severity, message, args) => console.log(name, message)
    }
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.info('Navigating to page:', URL);
  await page.goto(URL);
  console.info('Waiting for page to load...');

  // Wait for the local file to redirect on notebook >= 6.0
  await page.waitForNavigation();

  console.log('Waiting for page content..');
  const html = await page.content();
  if (inspect(html).indexOf('jupyter-config-data') === -1) {
    console.error('Error loading JupyterLab page:');
    console.error(html);
  }

  console.log('Waiting for #main selector...');
  await page.waitForSelector('#main', { timeout: 100000 });

  console.log('Waiting for #browserTest selector...');
  const el = await page.waitForSelector('#browserTest', {
    timeout: 100000,
    state: 'attached'
  });
  console.log('Waiting for application to start...');
  let testError = null;

  try {
    await page.waitForSelector('.completed', { state: 'attached' });
  } catch (e) {
    testError = e;
  }

  const loadedHtml = await page.content();
  await testJupyterfsExtension(loadedHtml);

  const textContent = await el.getProperty('textContent');
  const errors = JSON.parse(await textContent.jsonValue());

  for (let error of errors) {
    console.error(`Parsed an error from text content: ${error.message}`, error);
    testError = true;
  }

  // wait to finalize any outstanding GET requests
  await sleep(1000);

  await browser.close();

  if (testError) {
    throw testError;
  }
  console.info('Browser test complete');
}

// Stop the process if an error is raised in the async function.
process.on('unhandledRejection', up => {
  throw up;
});

void main();
