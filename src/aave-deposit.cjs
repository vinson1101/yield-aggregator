#!/usr/bin/env node
/**
 * Aave 存款测试 - 使用私钥直接执行
 */

const { createWalletClient, http, createPublicClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

const PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || '0x29b5a88baa09054abdbf18bfc6deaebe9acafd43a2730e5d42dae29f51e36675';
const SMART_ADDRESS = '0x5Bae0994344d22E0a3377e81204CC7c030c65e96';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const AAVE_POOL = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5';

const ERC20_ABI = [
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }
];

const AAVE_ABI = [
  { name: 'supply', type: 'function', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'onBehalfOf', type: 'address' }, { name: 'referralCode', type: 'uint16' }], outputs: [], stateMutability: 'nonpayable' }
];

async function main() {
  const amount = process.argv[2] || '1';
  const usdcAmount = BigInt(Math.floor(parseFloat(amount) * 1e6));
  
  console.log('=== Aave 存款测试 ===');
  console.log(`Amount: ${amount} USDC`);
  console.log('');

  const account = privateKeyToAccount(PRIVATE_KEY);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  
  const walletClient = createWalletClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
    account,
  });
  
  // 检查 USDC 余额
  const balance = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [SMART_ADDRESS]
  });
  
  console.log(`Smart Account USDC 余额: ${Number(balance) / 1e6}`);
  
  // 检查 allowance
  const allowance = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [SMART_ADDRESS, AAVE_POOL]
  });
  
  console.log(`Aave allowance: ${Number(allowance) / 1e6}`);
  
  // 如果需要 approve
  if (Number(allowance) < Number(usdcAmount)) {
    console.log('📝 Approving Aave...');
    
    const approveTx = await walletClient.writeContract({
      address: USDC,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [AAVE_POOL, BigInt(100 * 1e6)],
    });
    
    console.log(`Approve TX: https://basescan.org/tx/${approveTx}`);
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log('✅ Approve 完成\n');
  }
  
  // Deposit to Aave
  console.log(`💰 存入 ${amount} USDC 到 Aave...`);
  
  const depositTx = await walletClient.writeContract({
    address: AAVE_POOL,
    abi: AAVE_ABI,
    functionName: 'supply',
    args: [USDC, usdcAmount, SMART_ADDRESS, 0],
  });
  
  console.log(`Deposit TX: https://basescan.org/tx/${depositTx}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash: depositTx });
  
  console.log('✅ 存款完成!');
  console.log(`\n查看 Aave: https://app.aave.com/pool/`);
}

main().catch(console.error);
