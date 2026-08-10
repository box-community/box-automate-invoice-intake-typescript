// metadata.ts
import 'dotenv/config';
import { BoxApiError, BoxClient } from 'box-node-sdk';
import type { MetadataInstanceValue } from 'box-node-sdk/lib/schemas/metadataInstanceValue';

/**
 * Attach extracted values to the file as a metadata instance.
 *
 * Creates the instance on first run. On 409 Conflict (instance already
 * exists — common when retesting a file or when Box delivers a duplicate
 * webhook), falls back to a JSON-Patch update using op `add` so each
 * returned field is set whether or not it was present before.
 */
export async function applyMetadata(
  client: BoxClient,
  fileId: string,
  metadata: Record<string, unknown>,
) {
  const templateKey = process.env.BOX_METADATA_TEMPLATE_KEY!;

  try {
    return await client.fileMetadata.createFileMetadataById(
      fileId,
      'enterprise',
      templateKey,
      metadata,
    );
  } catch (error) {
    if (!(error instanceof BoxApiError) || error.responseInfo.statusCode !== 409) {
      throw error;
    }

    return client.fileMetadata.updateFileMetadataById(
      fileId,
      'enterprise',
      templateKey,
      Object.entries(metadata).map(([key, value]) => ({
        op: 'add' as const,
        path: `/${key}`,
        value: value as MetadataInstanceValue,
      })),
    );
  }
}
