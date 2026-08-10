# Box invoice intake automation (TypeScript)

A minimal, runnable reference service that watches a Box folder for new
invoice PDFs, extracts structured fields with
[Box AI Extract](https://developer.box.com/guides/box-ai/ai-tutorials/extract-metadata-structured),
and writes those values back to each file as Box metadata.

It implements the **webhook > extract > metadata** flow. An Express backend
receives a `FILE.UPLOADED` webhook (or a simulated curl payload), calls
`POST /2.0/ai/extract_structured` with your Invoice metadata template, and
attaches the result with `POST /2.0/files/:id/metadata/:scope/:template`.

This is the TypeScript companion repository to the tutorial:
**[Automate invoice intake with Box AI Extract](https://developer.box.com/tutorials/invoice-intake)**.

For the Python / Flask companion, see
[box-automate-invoice-intake](https://github.com/box-community/box-automate-invoice-intake).

## What it does

| Capability | How |
| --- | --- |
| Detect new invoice uploads | Box webhooks (`FILE.UPLOADED`) or a local curl simulation |
| Extract structured fields | `POST /2.0/ai/extract_structured` with a metadata template |
| Write values back to the file | `POST /2.0/files/:id/metadata/enterprise/:template` (create, or update on 409) |
| Optional ERP handoff | `erp.ts` builds a payload you can POST downstream |

## Project layout

```
box-automate-invoice-intake-typescript/
├── app.ts              # Express webhook listener
├── boxClient.ts        # CCG Service Account auth
├── extract.ts          # Box AI structured extract
├── metadata.ts         # Attach metadata to the file (409 upsert)
├── erp.ts              # Optional ERP payload builder
├── sample-invoice.pdf
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## Prerequisites

- **Node.js 20+**
- A [free Box developer account](https://account.box.com/signup/developer),
  or a [Box Enterprise account](https://www.box.com/pricing) with **Box AI**
  enabled. Consumer/Individual accounts do not work.
- A **Client Credentials Grant (CCG)** Platform App, **authorized** in the
  Admin Console, with these scopes enabled:
  - **Read and write all files and folders stored in Box**
  - **Manage AI**
  - **Manage webhooks**
- An **Invoice** metadata template in the Admin Console (see Setup below)
- An **Invoices Inbox** folder in Box, with the app's **Service Account**
  invited as an **Editor** collaborator

## Setup

1. **Clone and enter the project**

   ```bash
   git clone https://github.com/box-community/box-automate-invoice-intake-typescript.git
   cd box-automate-invoice-intake-typescript
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create the Invoice metadata template** (Admin Console > **Metadata** >
   **Invoices** tab > **New**). Name it `Invoice` and add these fields:

   | Field name | Type | Description |
   | --- | --- | --- |
   | Vendor Name | Text | Vendor or supplier name |
   | Invoice Number | Text | Unique invoice identifier |
   | Invoice Date | Date | Date the invoice was issued |
   | Due Date | Date | Payment due date |
   | Total Amount | Number | Total due, including taxes and fees |
   | Currency | Text | Three-letter currency code (USD, EUR, GBP) |

   Copy the **template key** shown under Template Name — you need it for `.env`.

4. **Create the Invoices Inbox folder** in Box and note its folder ID from
   the URL (`https://app.box.com/folder/123456789` → `123456789`).

   **Critical:** invite the app's Service Account as an **Editor** on that
   folder. Find the Service Account email in Developer Console > your app >
   **General Settings** > **Service Account ID** (looks like
   `AutomationUser_xxxxx_xxxxxx@boxdevedition.com`). Without this
   collaboration, API calls return `404 Not Found`.

5. **Configure credentials**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in:

   - `BOX_CLIENT_ID`, `BOX_CLIENT_SECRET`, `BOX_ENTERPRISE_ID` from the Developer Console
   - `BOX_METADATA_TEMPLATE_KEY` from step 3
   - `INVOICES_FOLDER_ID` from step 4

   > **Never commit `.env`.** It is already in `.gitignore`.

## Run

```bash
npm start
```

The server starts on `http://127.0.0.1:5000`.

## Try it

You can exercise the whole pipeline locally without a public URL or a real
webhook. You need **two terminals**: one running the Express server, one
sending a simulated payload.

1. **Upload `sample-invoice.pdf`** to your Invoices Inbox folder in Box.
   Note the **file ID** from the file URL
   (`https://app.box.com/file/123456789` → `123456789`). Use the file ID,
   not the folder ID.

2. **Start the server** (terminal 1):

   ```bash
   npm start
   ```

3. **Simulate a webhook** (terminal 2 — replace `<FILE_ID>`):

   ```bash
   curl -X POST http://127.0.0.1:5000/webhook \
     -H "Content-Type: application/json" \
     -d '{
       "trigger": "FILE.UPLOADED",
       "source": {
         "id": "<FILE_ID>",
         "name": "sample-invoice.pdf"
       }
     }'
   ```

4. **Check the result.** Terminal 1 should print extracted fields and confirm
   metadata was applied. Open the file in Box > **Metadata** tab to verify.

### Register a real webhook (production)

For automatic processing when files arrive, expose the app over HTTPS (for
example with a tunnel) and register a webhook on the inbox folder:

```bash
curl -X POST https://api.box.com/2.0/webhooks \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "target": {
      "id": "<FOLDER_ID>",
      "type": "folder"
    },
    "address": "<webhook_url>/webhook",
    "triggers": ["FILE.UPLOADED"]
  }'
```

In production, [verify webhook signatures](https://developer.box.com/guides/webhooks/v2/signatures-v2)
before processing.

## How it works

1. A PDF lands in the Invoices Inbox (or you POST a simulated webhook).
2. `extract.ts` calls Box AI with your Invoice metadata template so the
   response shape is consistent across vendor formats.
3. `metadata.ts` writes those values onto the file as an enterprise metadata
   instance. On first run it creates the instance; on `409 Conflict` (retest
   or duplicate webhook) it updates with a JSON-Patch `add` for each returned
   field.
4. Optionally, uncomment the `pushToErp(...)` call in `app.ts` to hand off
   structured totals to an ERP.

## Security notes

- Keep the client secret, enterprise ID, and access tokens server-side.
- Grant the Service Account only the folder access it needs (Editor on the
  inbox is enough for this sample).
- Verify webhook signatures in production.
- The metadata write is safe to re-run: `metadata.ts` upserts on `409`.
  Optionally skip a second AI extract when an instance already exists if
  you want to avoid duplicate extraction cost.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `unauthorized_client` | Authorize the app in the Admin Console (Developer Console > Authorization > Review and Submit). |
| `invalid_client` | Check `BOX_CLIENT_ID` / `BOX_CLIENT_SECRET` / `BOX_ENTERPRISE_ID` in `.env`. |
| `404 Not Found` | Invite the Service Account as **Editor** on the Invoices Inbox folder (and on the file's parent if different). |
| `409 Conflict on Metadata Instance` | The file already has the template. Current `metadata.ts` upserts on 409 — pull the latest code. To retest from a clean slate, delete the instance from the file's **Metadata** tab or via `DELETE /2.0/files/:id/metadata/enterprise/:template`. |
| `metadata_template must have both scope and template_key` | Set `BOX_METADATA_TEMPLATE_KEY` in `.env` to the key from the Admin Console. |
| `Cannot find module 'box-node-sdk'` | Run `npm install`. Confirm Node.js 20+ (`node -v`). |
| Extraction fails / AI errors | Confirm the **Manage AI** scope is enabled and the app was re-authorized after enabling it. Box AI must be available on the account. |
| curl hangs / no response | Another process may be holding port 5000. Run `lsof -nP -iTCP:5000 -sTCP:LISTEN` and stop it. On macOS, AirPlay Receiver can also claim port 5000. |

## Related

- Tutorial: [Automate invoice intake with Box AI Extract](https://developer.box.com/tutorials/invoice-intake)
- Python companion: [box-automate-invoice-intake](https://github.com/box-community/box-automate-invoice-intake)

## License

[MIT](./LICENSE)
