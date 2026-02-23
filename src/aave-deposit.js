#!/usr/bin/env npx tsx
/**
 * Aave 存款测试 - 使用私钥直接执行
 * 用法: node aave-deposit.js [金额]
 */

import { createWalletClient, http, createPublicClient, parseAbi, encodeFunctionData, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || '0x29b5a88baa09054abdbf18bfc6deaebe9acafd43a2730e5d42dae29f51e36675';
const SMART_ADDRESS = '0x125379C903a4E90529A6DCDe40554418fA200399';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const AAVE_POOL = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5';

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)'
]);

const AAVE_ABI = parseAbi([
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)'
]);

async function main() {
  const amount = process.argv[2] || '1';
  const usdcAmount = parseUnits(amount, 6);
  
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
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [AAVE_POOL, BigInt(100 * 1e6)]
    });
    
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
  const supplyData = encodeFunctionData({
    abi: AAVE_ABI,
    functionName: 'supply',
    args: [USDC, usdcAmount, SMART_ADDRESS, 0n]
  });
  
  const depositTx = await walletClient.writeContract({
    address: AAVE_POOL,
    abi: AAVE_ABI,
    functionName: 'supply',
    args: [USDC, usdcAmount, SMART_ADDRESS, 0n],
  });
  
  console.log(`Deposit TX: https://basescan.org/tx/${depositTx}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash: depositTx });
  
  console.log('✅ 存款完成!');
  console.log(`\n查看 Aave: https://app.aave.com/pool/`);
}

main().catch(console.error);
