// tests/smoke.ts
import assert from 'node:assert/strict';
import { ChildProcess } from 'node:child_process';
import { BASE_URL, postWebhook, startServer, stopServer } from './server';

/**
 * Offline smoke test: boots the Express app and exercises every route that
 * does not call Box. Needs no credentials, so it runs on every push and PR.
 */
async function main() {
  let server: ChildProcess | undefined;
  try {
    server = await startServer({
      ...process.env,
      BOX_CLIENT_ID: 'smoke-test',
      BOX_CLIENT_SECRET: 'smoke-test',
      BOX_ENTERPRISE_ID: '0',
      BOX_METADATA_TEMPLATE_KEY: 'smoke-test',
    });

    const index = await fetch(`${BASE_URL}/`);
    assert.equal(index.status, 200);
    const indexBody = (await index.json()) as Record<string, unknown>;
    assert.ok(indexBody.endpoints, 'GET / should describe the endpoints');

    const ignored = await postWebhook({ trigger: 'FOLDER.CREATED', source: { id: '1' } });
    assert.deepEqual(ignored, { status: 200, body: { status: 'ignored' } });

    const skipped = await postWebhook({
      trigger: 'FILE.UPLOADED',
      source: { id: '1', name: 'notes.txt' },
    });
    assert.deepEqual(skipped, { status: 200, body: { status: 'skipped, not a PDF' } });

    console.log('Smoke test passed');
  } finally {
    stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
