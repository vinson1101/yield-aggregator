#!/usr/bin/env node
/**
 * Yield Aggregator - 自动切换 (使用 EOA 私钥)
 */

const { createWalletClient, http, parseAbi, encodeFunctionData } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

const PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || '0x29b5a88baa09054abdbf18bfc6deaebe9acafd43a2730e5d42dae29f51e36675';
const WALLET = '0x1758DE3E2cf746F4eEb7143c3935fCa1B30060ce';

const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const AAVE_POOL = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5';
const AAVE_ATOKEN = '0x4e65fe4dba92790696d040ac24aa414708f5c0ab';
const MORPHO = '0x8A034f069D59d62a4643ad42E49b846d036468D7';

const AAVE_APY = 0.035;
const MORPHO_APY = 0.098;

const ERC20 = [
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }
];

const AAVE_ABI = [
  { name: 'supply', type: 'function', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'onBehalfOf', type: 'address' }, { name: 'referralCode', type: 'uint16' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'withdraw', type: 'function', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'to', type: 'address' }], outputs: [], stateMutability: 'nonpayable' }
];

const MORPHO_ABI = [
  { name: 'deposit', type: 'function', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'withdraw', type: 'function', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' }
];

async function main() {
  const action = process.argv[2] || 'check';
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  const wallet = createWalletClient({ chain: base, transport: http(), account });
  const { createPublicClient } = require('viem');
  const publicClient = createPublicClient({ chain: base, transport: http() });

  console.log('=== Yield Aggregator (EOA) ===\n');

  const usdcBalance = await publicClient.readContract({ address: USDC, abi: ERC20, functionName: 'balanceOf', args: [WALLET] });
  const aaveBalance = await publicClient.readContract({ address: AAVE_ATOKEN, abi: ERC20, functionName: 'balanceOf', args: [WALLET] });
  const morphoShares = await publicClient.readContract({ address: MORPHO, abi: ERC20, functionName: 'balanceOf', args: [WALLET] });

  console.log('📊 当前状态:');
  console.log(`  Wallet USDC: ${Number(usdcBalance) / 1e6}`);
  console.log(`  Aave aUSDC:  ${Number(aaveBalance) / 1e6} (APY: ${AAVE_APY * 100}%)`);
  console.log(`  Morpho:     ${Number(morphoShares) / 1e18} shares (APY: ${MORPHO_APY * 100}%)\n`);

  if (action === 'check') {
    const totalAave = Number(aaveBalance) / 1e6;
    const totalMorpho = Number(morphoShares) / 1e18;
    
    console.log('📈 收益比较:');
    console.log(`  Aave:   ${AAVE_APY * 100}% → 年收益: $${(totalAave * AAVE_APY).toFixed(4)}`);
    console.log(`  Morpho: ${MORPHO_APY * 100}% → 年收益: $${(totalMorpho * MORPHO_APY).toFixed(4)}\n`);
    
    if (totalMorpho > 0 && totalAave > 0) {
      if (MORPHO_APY > AAVE_APY) {
        console.log(`🎯 建议: 从 Aave 切换到 Morpho (多赚 ${(MORPHO_APY - AAVE_APY) * 100}%)`);
      }
    } else if (totalAave > 0) {
      console.log(`🎯 建议: 切换到 Morpho`);
    } else if (totalMorpho > 0) {
      console.log('💤 当前已是最高收益 (Morpho)');
    }
    return;
  }

  if (action === 'switch' || action === 'auto') {
    // 自动切换逻辑
    const totalAave = Number(aaveBalance) / 1e6;
    
    if (totalAave > 0) {
      console.log('🔄 从 Aave 切换到 Morpho...\n');
      
      // 取款
      console.log('1️⃣ 从 Aave 取款...');
      const withdrawTx = await wallet.writeContract({
        address: AAVE_POOL, abi: AAVE_ABI, functionName: 'withdraw',
        args: [USDC, aaveBalance, WALLET]
      });
      console.log(`   TX: https://basescan.org/tx/${withdrawTx}`);
      
      // 等待确认
      await new Promise(r => setTimeout(r, 3000));
      
      // Approve
      console.log('2️⃣ Approve...');
      await wallet.writeContract({
        address: USDC, abi: ERC20, functionName: 'approve',
        args: [MORPHO, aaveBalance]
      });
      
      // 存款
      console.log('3️⃣ 存入 Morpho...');
      const depositTx = await wallet.writeContract({
        address: MORPHO, abi: MORPHO_ABI, functionName: 'deposit',
        args: [aaveBalance, WALLET]
      });
      console.log(`   TX: https://basescan.org/tx/${depositTx}`);
      
      console.log('\n✅ 切换完成!');
    } else {
      console.log('💤 无 Aave 存款需要切换');
    }
  }
}

main().catch(console.error);
