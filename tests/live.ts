// tests/live.ts
import 'dotenv/config';
import assert from 'node:assert/strict';
import { ChildProcess } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { getBoxClient } from '../boxClient';
import { postWebhook, startServer, stopServer } from './server';

const REQUIRED_ENV = [
  'BOX_CLIENT_ID',
  'BOX_CLIENT_SECRET',
  'BOX_ENTERPRISE_ID',
  'BOX_METADATA_TEMPLATE_KEY',
  'INVOICES_FOLDER_ID',
];

// Box AI extraction can take well over the default fetch timeout.
const EXTRACT_TIMEOUT_MS = 180_000;

/**
 * Live end-to-end test against a real Box enterprise. Runs the tutorial flow
 * exactly as a reader would: upload sample-invoice.pdf, POST a simulated
 * FILE.UPLOADED webhook, then read back the metadata instance. Sends the
 * webhook twice so the 409 update path in metadata.ts runs as well.
 *
 * Works in a throwaway subfolder of INVOICES_FOLDER_ID and deletes it at the end.
 */
async function main() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  const client = getBoxClient();
  const templateKey = process.env.BOX_METADATA_TEMPLATE_KEY!;
  const runId = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`;

  const folder = await client.folders.createFolder({
    name: `ci-run-${runId}`,
    parent: { id: process.env.INVOICES_FOLDER_ID! },
  });

  let server: ChildProcess | undefined;
  try {
    const uploaded = await client.uploads.uploadFile({
      attributes: { name: 'sample-invoice.pdf', parent: { id: folder.id } },
      file: createReadStream('sample-invoice.pdf'),
    });
    const fileId = uploaded.entries![0].id;
    console.log(`Uploaded sample-invoice.pdf as file ${fileId}`);

    server = await startServer();
    const webhook = {
      trigger: 'FILE.UPLOADED',
      source: { id: fileId, name: 'sample-invoice.pdf' },
    };

    const first = await postWebhook(webhook, EXTRACT_TIMEOUT_MS);
    assert.deepEqual(first, { status: 200, body: { status: 'processed', file_id: fileId } });

    const second = await postWebhook(webhook, EXTRACT_TIMEOUT_MS);
    assert.deepEqual(second, { status: 200, body: { status: 'processed', file_id: fileId } });

    const metadata = await client.fileMetadata.getFileMetadataById(
      fileId,
      'enterprise',
      templateKey,
    );
    const fields = metadata.extraData ?? {};
    console.log('Metadata on file:', JSON.stringify(fields, null, 2));

    assert.match(String(fields.invoiceNumber ?? ''), /INV-001/);
    assert.equal(Number(fields.totalAmount), 1250);

    console.log('Live test passed');
  } finally {
    stopServer(server);
    await client.folders.deleteFolderById(folder.id, { queryParams: { recursive: true } });
    console.log(`Deleted test folder ${folder.id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
