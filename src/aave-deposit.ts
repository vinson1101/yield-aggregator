#!/usr/bin/env npx tsx
/**
 * Aave 存款测试 - 使用 viem + CDP Smart Account
 * 用法: EVM_PRIVATE_KEY=0x... node aave-deposit.ts [1] - 存款 1 USDC 到 Aave
 */

import { createWalletClient, http } from 'viem';
import { privateKeyToAccount, createPublicClient } from 'viem/accounts';
import { base } from 'viem/chains';
import { parseUnits, parseEther } from 'viem';
import dotenv from 'dotenv';

dotenv.config({ path: '/root/.openclaw/workspace/.env.cdp' });

const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const AAVE_POOL = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5';
const AAVE_ROUTER = '0xBA52558d60c901f458998b366a7cc18c91b1a5c6';
const PERMIT2 = '0x00000000000000000000000000000000000000';

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)'
]);

const AAVE_ABI = parseAbi([
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
]);

async function main() {
  const amount = process.argv[2] || '1';
  const usdcAmount = parseUnits(amount, 6);
  
  console.log('=== Aave 存款 ===');
  console.log(`Amount: ${amount} USDC`);
  console.log('');

  const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY!);
  console.log('Wallet:', account.address);
  const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') });
  
  // Check USDC balance
  const balance = await walletClient.getBalance({ address: USDC });
  const balanceValue = balance.value;
  
  console.log(`USDC 余额: ${balanceValue / 1e6} USDC`);
  
  if (balanceValue < usdcAmount) {
    console.log('❌ 余额不足');
    return;
  }
  
  // Check allowance
  const allowance = await walletClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, AAVE_ROUTER]
  });
  
  const allowanceValue = allowance || 0n;
  
  console.log(`Aave Router Allowance: ${allowanceValue / 1e6} USDC`);
  
  // Approve Aave Router if needed
  if (allowanceValue < usdcAmount) {
    console.log('📝 Approve Aave Router...');
    
    const hash = await walletClient.writeContract({
      address: USDC,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [AAVE_ROUTER, usdcAmount]
    });
    
    console.log(`Approve TX: https://basescan.org/tx/${hash}`);
    console.log('等待确认...');
    await walletClient.waitForTransactionReceipt({ hash });
    console.log('✅ Approve 完成');
  }
  
  // Deposit to Aave
  console.log(`💰 存入 ${amount} USDC 到 Aave...`);
  
  const hash = await walletClient.writeContract({
    address: AAVE_POOL,
    abi: AAVE_ABI,
    functionName: 'supply',
    args: [USDC, usdcAmount, account.address, 0n]
  });
  
  console.log(`Deposit TX: https://basescan.org/tx/${hash}`);
  console.log('等待确认...');
  
  const receipt = await walletClient.waitForTransactionReceipt({ hash });
  
  console.log('✅ 存款完成!');
  console.log(`余额: ${Number(receipt.logs[3]) / 1e6} USDC`);
  console.log(`Aave: https://app.aave.com/`);
}

main().catch(console.error);
