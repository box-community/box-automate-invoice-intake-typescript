// app.ts
import express, { Request, Response } from 'express';
import { getBoxClient } from './boxClient';
import { extractInvoiceFields } from './extract';
import { applyMetadata } from './metadata';
// import { pushToErp } from './erp';

const app = express();
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    service: 'Box invoice intake automation (TypeScript)',
    endpoints: {
      'POST /webhook':
        'Receive FILE.UPLOADED webhook payloads, extract invoice fields with Box AI, and write metadata',
      'GET /health': 'Liveness check',
    },
    local_test:
      'curl -X POST http://127.0.0.1:5000/webhook ' +
      '-H "Content-Type: application/json" ' +
      '-d \'{"trigger":"FILE.UPLOADED","source":{"id":"<FILE_ID>","name":"sample-invoice.pdf"}}\'',
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Handle Box FILE.UPLOADED webhooks for the Invoices Inbox folder.
 *
 * In production, verify webhook signatures before processing. See:
 * https://developer.box.com/guides/webhooks/v2/signatures-v2
 */
app.post('/webhook', async (req: Request, res: Response) => {
  const payload = req.body;

  if (!payload || payload.trigger !== 'FILE.UPLOADED') {
    res.status(200).json({ status: 'ignored' });
    return;
  }

  const fileId = payload.source.id as string;
  const fileName = payload.source.name as string;

  if (!fileName.toLowerCase().endsWith('.pdf')) {
    res.status(200).json({ status: 'skipped, not a PDF' });
    return;
  }

  const client = getBoxClient();

  const extracted = await extractInvoiceFields(client, fileId);
  console.log(`Extracted from ${fileName}:`, JSON.stringify(extracted, null, 2));

  await applyMetadata(client, fileId, extracted);
  console.log(`Metadata applied to file ${fileId}`);

  // Optional: push structured totals to an ERP.
  // pushToErp(extracted, fileId);

  res.status(200).json({ status: 'processed', file_id: fileId });
});

app.listen(5000, () => {
  console.log('Listening on http://127.0.0.1:5000');
});
