const { createPublicClient, http, parseAbi } = require('viem');
const { base } = require('viem/chains');

const AAVE = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5';
const EOA = '0x1758DE3E2cf746F4eEb7143c3935fCa1B30060ce';

const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

const abi = [
  { name: 'getUserAccountData', type: 'function', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], stateMutability: 'view' }
];

async function main() {
  const data = await publicClient.readContract({ address: AAVE, abi, functionName: 'getUserAccountData', args: [EOA] });

  console.log('Aave Position (EOA 0x1758):');
  console.log('  Collateral:', Number(data[0]) / 1e8, 'USD');
  console.log('  Debt:', Number(data[1]) / 1e8, 'USD');
}

main().catch(console.error);
