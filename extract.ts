// extract.ts
import 'dotenv/config';
import { BoxClient } from 'box-node-sdk';
import { AiItemBase } from 'box-node-sdk/lib/schemas/aiItemBase';

/**
 * Call Box AI structured extract with the Invoice metadata template.
 * The template tells Box AI which fields to look for and what data types
 * to return, so the response shape is predictable across vendor formats.
 */
export async function extractInvoiceFields(
  client: BoxClient,
  fileId: string,
): Promise<Record<string, unknown>> {
  const templateKey = process.env.BOX_METADATA_TEMPLATE_KEY!;

  const result = await client.ai.createAiExtractStructured({
    items: [new AiItemBase({ id: fileId })],
    metadataTemplate: {
      templateKey,
      type: 'metadata_template',
      scope: 'enterprise',
    },
  });

  return result.answer as Record<string, unknown>;
}
