#!/usr/bin/env node
/**
 * Yield Executor - 完整执行器
 * 包含 approve + deposit/withdraw
 */

import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const AAVE_POOL = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5';

// USDC ABI (approve + balanceOf)
const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  }
];

// Aave ABI
const AAVE_ABI = [
  {
    name: 'supply',
    type: 'function',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'withdraw',
    type: 'function',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable'
  },
  {
    name: 'getUserAccountData',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'totalCollateralBase', type: 'uint256' },
      { name: 'totalDebtBase', type: 'uint256' },
      { name: 'availableBorrowsBase', type: 'uint256' },
      { name: 'currentLiquidationThreshold', type: 'uint256' },
      { name: 'ltv', type: 'uint256' },
      { name: 'healthFactor', type: 'uint256' }
    ],
    stateMutability: 'view'
  }
];

async function main() {
  const action = process.argv[2] || 'status';
  const amount = process.argv[3] || '0';
  
  console.log('=== Yield Executor ===');
  console.log(`Action: ${action}, Amount: ${amount}`);
  console.log('');

  const privateKey = process.env.EVM_PRIVATE_KEY;
  if (!privateKey) {
    console.log('❌ 需要设置 EVM_PRIVATE_KEY');
    return;
  }

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: base, transport: http() });
  const walletClient = createWalletClient({ account, chain: base, transport: http() });

  console.log(`Wallet: ${account.address}`);
  console.log('');

  try {
    // 查看 USDC 余额
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    console.log(`USDC 余额: ${Number(balance) / 1e6}`);
    
    // 查看 allowance
    const allowance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [account.address, AAVE_POOL]
    });
    console.log(`Aave Allowance: ${Number(allowance) / 1e6}`);
    console.log('');

    if (action === 'status') {
      console.log('📊 Aave 状态...');
      const data = await publicClient.readContract({
        address: AAVE_POOL,
        abi: AAVE_ABI,
        functionName: 'getUserAccountData',
        args: [account.address]
      });
      
      console.log('Aave Position:');
      console.log(`  抵押: $${Number(data[0]) / 1e8}`);
      console.log(`  债务: $${Number(data[1]) / 1e8}`);
      console.log(`  可借: $${Number(data[2]) / 1e8}`);
      
    } else if (action === 'deposit') {
      const usdcAmount = parseUnits(amount, 6);
      
      // 如果需要 approve
      if (allowance < usdcAmount) {
        console.log('📝 Approve USDC...');
        const approveHash = await walletClient.writeContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [AAVE_POOL, usdcAmount]
        });
        console.log(`✅ Approve TX: https://basescan.org/tx/${approveHash}`);
        console.log('等待确认...');
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        console.log('Approve 完成');
      }
      
      console.log(`💰 存入 ${amount} USDC 到 Aave...`);
      const hash = await walletClient.writeContract({
        address: AAVE_POOL,
        abi: AAVE_ABI,
        functionName: 'supply',
        args: [USDC_ADDRESS, usdcAmount, account.address, 0n]
      });
      
      console.log(`✅ 存款成功!`);
      console.log(`   TX: https://basescan.org/tx/${hash}`);
      
    } else if (action === 'withdraw') {
      const usdcAmount = amount === 'max' ? 2n ** 256n - 1n : parseUnits(amount, 6);
      console.log(`💰 从 Aave 取款 ${amount} USDC...`);
      
      const hash = await walletClient.writeContract({
        address: AAVE_POOL,
        abi: AAVE_ABI,
        functionName: 'withdraw',
        args: [USDC_ADDRESS, usdcAmount, account.address]
      });
      
      console.log(`✅ 取款成功!`);
      console.log(`   TX: https://basescan.org/tx/${hash}`);
      
    } else {
      console.log(`未知操作: ${action}`);
    }
    
  } catch (error) {
    console.log(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

main();
