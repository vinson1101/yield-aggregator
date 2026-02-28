const { CdpClient } = require('@coinbase/cdp-sdk');
const dotenv = require('dotenv');
dotenv.config({ path: '/root/.openclaw/workspace/.env.cdp' });

const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
});

async function main() {
  const account = await cdp.evm.getAccount({
    address: '0x5Bae0994344d22E0a3377e81204CC7c030c65e96'
  });
  
  console.log('Account:', account.address);
}

main();
