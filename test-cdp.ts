import { CdpClient } from '@coinbase/cdp-sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.cdp' });

const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID!,
  apiKeySecret: process.env.CDP_API_KEY_SECRET!,
});

async function main() {
  try {
    const result = await cdp.evm.listSmartAccounts();
    console.log('Found', result.accounts.length, 'accounts:');
    result.accounts.forEach(a => {
      console.log(' -', a.address);
    });
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
