// boxClient.ts
import 'dotenv/config';
import { BoxClient, BoxCcgAuth, CcgConfig } from 'box-node-sdk';

/**
 * Authenticate as the application's Service Account using CCG.
 * Client Credentials Grant is recommended for server-to-server
 * automations where no end user is present.
 */
export function getBoxClient(): BoxClient {
  const config = new CcgConfig({
    clientId: process.env.BOX_CLIENT_ID!,
    clientSecret: process.env.BOX_CLIENT_SECRET!,
    enterpriseId: process.env.BOX_ENTERPRISE_ID!,
  });
  const auth = new BoxCcgAuth({ config });
  return new BoxClient({ auth });
}
