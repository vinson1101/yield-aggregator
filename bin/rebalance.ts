#!/usr/bin/env npx tsx
/**
 * Yield Aggregator - 使用 CDP Smart Account 自动切换收益协议
 */

import { CdpClient } from '@coinbase/cdp-sdk';
import { createPublicClient, http, parseAbi, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config({ path: '/root/.openclaw/workspace/base-trading-framework/.env.cdp' });

const SMART_ACCOUNT = '0x125379C903a4E90529A6DCDe40554418fA200399';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const AAVE_POOL = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5';
const AAVE_ATOKEN = '0x4e65fe4dba92790696d040ac24aa414708f5c0ab';
const MORPHO_VAULT = '0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca';

const AAVE_APY = 0.035;
const MORPHO_APY = 0.098;

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
]);

const AAVE_ABI = parseAbi([
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to)',
]);

const MORPHO_ABI = parseAbi([
  'function deposit(uint256 assets, address receiver) returns (uint256)',
]);

async function main() {
  const action = process.argv[2] || 'check';
  
  const cdp = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
  });

  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

  console.log('=== Yield Aggregator (CDP Smart Account) ===\n');

  const usdcBalance = await publicClient.readContract({
    address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [SMART_ACCOUNT]
  });

  const aaveBalance = await publicClient.readContract({
    address: AAVE_ATOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [SMART_ACCOUNT]
  });

  console.log('📊 当前状态:');
  console.log(`  Wallet USDC: ${Number(usdcBalance) / 1e6}`);
  console.log(`  Aave aUSDC:  ${Number(aaveBalance) / 1e6} (APY: ${AAVE_APY * 100}%)`);
  console.log('');

  if (action === 'check') {
    const totalAave = Number(aaveBalance) / 1e6;
    
    if (totalAave > 0) {
      console.log(`📈 收益比较:`);
      console.log(`  Aave:   ${AAVE_APY * 100}% → 年收益: ${totalAave * AAVE_APY} USDC`);
      console.log(`  Morpho: ${MORPHO_APY * 100}% → 年收益: ${totalAave * MORPHO_APY} USDC`);
      console.log(`\n🎯 建议: 切换到 Morpho (多赚 ${(MORPHO_APY - AAVE_APY) * 100}%)`);
      console.log(`   执行: npx tsx bin/rebalance switch`);
    } else {
      console.log('💤 无 Aave 存款');
    }
    return;
  }

  if (action === 'switch') {
    if (Number(aaveBalance) === 0) {
      console.log('❌ Aave 无存款可切换');
      return;
    }

    console.log('🔄 从 Aave 切换到 Morpho...\n');

    // 获取 Smart Account
    const result = await cdp.evm.listSmartAccounts();
    const smartAcc = result.accounts.find(a => a.address.toLowerCase() === SMART_ACCOUNT.toLowerCase());
    const owner = smartAcc.owners[0];
    const ownerAccount = await cdp.evm.getAccount({ address: owner });
    const smartAccount = await cdp.evm.getSmartAccount({
      address: SMART_ACCOUNT,
      owner: ownerAccount,
    });

    // 1. 从 Aave 取款
    console.log('1️⃣ 从 Aave 取款...');
    const withdrawData = encodeFunctionData({
      abi: AAVE_ABI,
      functionName: 'withdraw',
      args: [USDC, aaveBalance, SMART_ACCOUNT]
    });

    const withdrawResult = await smartAccount.sendUserOperation({
      calls: [{ to: AAVE_POOL, data: withdrawData, value: 0n }],
      network: 'base'
    });

    console.log(`   UserOp: ${withdrawResult.userOpHash}`);
    await smartAccount.waitForUserOperation(withdrawResult.userOpHash);
    console.log('   ✅ 取款完成\n');

    // 2. 存入 Morpho
    console.log('2️⃣ 存入 Morpho...');
    
    // Approve
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [MORPHO_VAULT, aaveBalance]
    });

    await smartAccount.sendUserOperation({
      calls: [{ to: USDC, data: approveData, value: 0n }],
      network: 'base'
    });

    // Deposit
    const depositData = encodeFunctionData({
      abi: MORPHO_ABI,
      functionName: 'deposit',
      args: [aaveBalance, SMART_ACCOUNT]
    });

    const depositResult = await smartAccount.sendUserOperation({
      calls: [{ to: MORPHO_VAULT, data: depositData, value: 0n }],
      network: 'base'
    });

    console.log(`   UserOp: ${depositResult.userOpHash}`);
    await smartAccount.waitForUserOperation(depositResult.userOpHash);
    console.log('   ✅ 存款完成\n');

    console.log('✅ 切换成功!');
    console.log(`   从 Aave (${AAVE_APY * 100}%) → Morpho (${MORPHO_APY * 100}%)`);
    console.log(`   预计年收益: ${Number(aaveBalance) / 1e6 * MORPHO_APY} USDC (之前: ${Number(aaveBalance) / 1e6 * AAVE_APY} USDC)`);
  }
}

main().catch(console.error);
