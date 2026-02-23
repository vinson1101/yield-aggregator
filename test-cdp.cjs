const { CdpClient } = require('@coinbase/cdp-sdk');
const dotenv = require('dotenv');
dotenv.config({ path: '/root/.openclaw/workspace/.env.cdp' });

const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
});

async function main() {
  const account = await cdp.evm.getAccount({
    address: '0x125379C903a4E90529A6DCDe40554418fA200399'
  });
  
  console.log('Account:', account.address);
}

main();
