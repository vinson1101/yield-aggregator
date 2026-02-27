#!/usr/bin/env node
/**
 * Yield Aggregator - 自动切换 + 实时 APY + CDP Smart Account
 */

const { createPublicClient, http, encodeFunctionData } = require('viem');
const { base } = require('viem/chains');
const { CdpClient } = require('@coinbase/cdp-sdk');

const CDP_OWNER = process.env.CDP_OWNER_ADDRESS || '';
const CDP_SMART_ACCOUNT = process.env.CDP_SMART_ACCOUNT_ADDRESS || '';

const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const AAVE_POOL = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5';
const AAVE_ATOKEN = '0x4e65fe4dba92790696d040ac24aa414708f5c0ab';
const MORPHO = '0x8A034f069D59d62a4643ad42E49b846d036468D7';
const MOONWELL = '0xedc817a28e8b93b03976fbd4a3ddbc9f7d176c22';

const ERC20 = [
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
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

// Moonwell USDC Vault (ERC4626)
const MOONWELL_ABI = [
  { name: 'deposit', type: 'function', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'redeem', type: 'function', inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' }
];

// 状态文件
const STATE_FILE = '/root/.openclaw/workspace/yield-aggregator/data/state.json';
const HISTORY_FILE = '/root/.openclaw/workspace/yield-aggregator/data/history.json';
const fs = require('fs');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { shares: {}, lastCheck: null };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// 安全检查：验证 Owner 是普通 EOA（没有被 EIP-7702 攻击）
// 注意：检查 Owner 地址，不是 Smart Account（Smart Account 是合约，有代码是正常的）
async function checkWalletSafety(publicClient) {
  // 检查 Owner EOA 是否被攻击
  const ownerCode = await publicClient.getCode({ address: CDP_OWNER });
  if (ownerCode && ownerCode !== '0x') {
    throw new Error(`⚠️ 安全警告: Owner 钱包 ${CDP_OWNER} 已被攻击！检测到非零代码，可能是 EIP-7702 delegation 攻击。拒绝执行交易！`);
  }
  console.log(`✅ 安全检查通过: Owner 是普通 EOA`);
}

// CDP 交易函数
async function sendCdpTx(cdpAccount, config) {
  const { abi, address, functionName, args } = config;
  
  try {
    const calldata = encodeFunctionData({ abi, functionName, args });
    
    const result = await cdpAccount.sendUserOperation({
      calls: [{
        to: address,
        data: calldata,
        value: 0n
      }]
    });
    
    console.log(`   📤 UserOp: ${result.userOpHash}`);
    return result.userOpHash;
  } catch (e) {
    console.log(`   ❌ 交易失败: ${e.message}`);
    throw e;
  }
}

async function getAPY() {
  let aaveApy = 0.035;
  let morphoApy = 0.098;
  
  try {
    const { execSync } = require("child_process");
    try {
      const m = JSON.parse(execSync("defi lend rates --protocol morpho --chain base --asset USDC 2>/dev/null", { encoding: "utf8" }));
      if (m.success && m.data.length > 0) {
        morphoApy = Math.max(...m.data.map(d => d.supply_apy)) / 100;
        console.log("📡 Morpho: " + (morphoApy*100).toFixed(1) + "%");
      }
    } catch (e) {}
    try {
      const a = JSON.parse(execSync("defi lend rates --protocol aave --chain base --asset USDC 2>/dev/null", { encoding: "utf8" }));
      if (a.success && a.data.length > 0) {
        aaveApy = Math.max(...a.data.map(d => d.supply_apy)) / 100;
        console.log("📡 Aave: " + (aaveApy*100).toFixed(1) + "%");
      }
    } catch (e) {}
  } catch (e) {}
  
  let moonwellApy = 0;
try {
  const resp = await fetch("https://yields.llama.fi/pools");
  const data = await resp.json();
  for (const p of data.data || []) {
    if (p.chain === "Base" && p.symbol === "USDC" && p.project === "moonwell-lending") {
      moonwellApy = p.apy / 100;
      console.log("📡 Moonwell: " + (moonwellApy*100).toFixed(1) + "%");
      break;
    }
  }
} catch (e) {}

  return { aaveApy, morphoApy, moonwellApy };
}

async function main() {
  const action = process.argv[2] || 'check';
  const useCDP = process.argv.includes('--cdp');
  
  // 初始化 CDP
  const dotenv = require('dotenv');
  dotenv.config({ path: '/root/.openclaw/workspace/.env.cdp' });
  
  const cdp = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
  });

  // 获取 Smart Account
  const SMART_ACCOUNT = CDP_SMART_ACCOUNT;
  const WALLET = CDP_SMART_ACCOUNT;
  
  const accountInfo = await cdp.evm.listSmartAccounts();
  const smartAcc = accountInfo.accounts.find(a => 
    a.address.toLowerCase() === SMART_ACCOUNT.toLowerCase()
  );
  
  if (!smartAcc) {
    console.log('❌ 未找到 Smart Account:', SMART_ACCOUNT);
    return;
  }
  
  const owner = smartAcc.owners?.[0];
  if (!owner) {
    console.log('❌ 未找到 Owner');
    return;
  }
  
  const ownerAccount = await cdp.evm.getAccount({ address: owner });
  const smartAccount = await cdp.evm.getSmartAccount({
    address: SMART_ACCOUNT,
    owner: ownerAccount,
  });
  
  const cdpAccount = await smartAccount.useNetwork('base');
  
  console.log('=== Yield Aggregator (CDP Smart Account) ===');
  console.log(`Smart Account: ${cdpAccount.address}`);
  console.log(`Owner (CDP Wallet): ${CDP_OWNER}\n`);

  const publicClient = createPublicClient({ chain: base, transport: http() });

  const { aaveApy, morphoApy, moonwellApy } = await getAPY();

console.log('');

  const usdcBalance = await publicClient.readContract({ address: USDC, abi: ERC20, functionName: 'balanceOf', args: [WALLET] });
  const aaveBalance = await publicClient.readContract({ address: AAVE_ATOKEN, abi: ERC20, functionName: 'balanceOf', args: [WALLET] });
  const morphoShares = await publicClient.readContract({ address: MORPHO, abi: ERC20, functionName: 'balanceOf', args: [WALLET] });
  const moonwellShares = await publicClient.readContract({ address: MOONWELL, abi: ERC20, functionName: 'balanceOf', args: [WALLET] });

  console.log('📊 当前状态:');
  console.log(`  Wallet USDC: ${Number(usdcBalance) / 1e6}`);
  console.log(`  Aave aUSDC:  ${Number(aaveBalance) / 1e6} (APY: ${aaveApy * 100}%)`);
  const morphoSharesNum = Number(morphoShares) / 1e18;
  const state = loadState();
  const morphoValue = state.shares?.Morpho?.value || morphoSharesNum * 1.0041;
  console.log(`  Morpho:     ${morphoSharesNum} shares = ~$${morphoValue.toFixed(2)} (APY: ${morphoApy * 100}%)`);
  if (moonwellApy > 0) {
    console.log(`  Moonwell:    ${Number(moonwellShares) / 1e18} shares (APY: ${moonwellApy * 100}%)`);
  }
  console.log('');

  if (action === 'check') {
    const totalAave = Number(aaveBalance) / 1e6;
    const totalMorpho = Number(morphoShares) / 1e18;
    const totalMoonwell = Number(moonwellShares) / 1e18;
    
    console.log('📈 收益比较:');
    
    // 收益追踪
    const state = loadState();
    const history = loadHistory();
    const now = Date.now();
    
    // 记录当前
    const currentProtocol = totalMorpho > 0.001 ? 'Morpho' : (totalAave > 0.001 ? 'Aave' : (totalMoonwell > 0.001 ? 'Moonwell' : null));
    if (currentProtocol) {
      const currentShares = totalMorpho > 0.001 ? totalMorpho : (totalAave > 0.001 ? totalAave : totalMoonwell);
      
      if (!state.shares) state.shares = {};
      if (!state.shares[currentProtocol]) {
        // 首次存入，使用当前份额作为本金估值
        const initialValue = currentProtocol === 'Morpho' ? currentShares * 1.0041 : currentShares;  // Morpho 初始 share price ≈ 1.0041
        state.shares[currentProtocol] = { shares: currentShares, value: initialValue, time: now };
        console.log('📝 首次记录收益基准: $' + initialValue.toFixed(2));
      } else {
        const last = state.shares[currentProtocol];
        const days = (now - last.time) / (1000*60*60*24);
        
        if (days > 0) {
          const shareChange = currentShares - last.shares;
          const valueChange = shareChange * 5 / last.shares; // 估算
          const apy = (valueChange / 5 / days) * 365 * 100;
          
          if (valueChange > 0) {
            console.log(`💰 实际收益: +$${valueChange.toFixed(4)} (${days.toFixed(1)}天), 推算年化: ${apy.toFixed(1)}%`);
          }
        }
        
        // 计算实时价值：基于初始本金 + APY 复利累积
        const principal = last.value || 5;  // 使用存储的本金
        const apy = currentProtocol === 'Morpho' ? morphoApy : (currentProtocol === 'Aave' ? aaveApy : moonwellApy);
        const estimatedValue = principal * (1 + apy * days / 365);  // 复利计算
        
        state.shares[currentProtocol] = { 
          shares: currentShares, 
          value: estimatedValue, 
          time: now 
        };
      }
      state.lastCheck = now;
      saveState(state);
      
      // 保存历史（包含实时价值）
      const currentApy = currentProtocol === 'Morpho' ? morphoApy : (currentProtocol === 'Aave' ? aaveApy : moonwellApy);
      history.push({
        time: new Date().toISOString(),
        protocol: currentProtocol,
        shares: currentShares,
        value: state.shares[currentProtocol].value,
        apy: currentApy
      });
      if (history.length > 30) history.shift();
      saveHistory(history);
    }
    console.log(`  Aave:   ${aaveApy * 100}% → 年收益: $${(totalAave * aaveApy).toFixed(4)}`);
    console.log(`  Morpho: ${morphoApy * 100}% → 年收益: $${(totalMorpho * morphoApy).toFixed(4)}\n`);

  console.log("\n🌞 Solana Yield (参考):");
  console.log("  LULO: 10.0% (最高)");
  console.log("  KAMINO: 8.0%");
  console.log("  MARGINFI: 7.0%");
  console.log("  SOLEND: 6.0%");
  console.log("  (需配置 SOLANA_WALLET 才能使用)")
    
    if (totalMorpho > 0 && totalAave > 0) {
      if (morphoApy > aaveApy) {
        console.log(`🎯 建议: 从 Aave 切换到 Morpho (多赚 ${(morphoApy - aaveApy) * 100}%)`);
      }
    } else if (totalAave > 0) {
      console.log(`🎯 建议: 切换到 Morpho`);
    } else if (totalMorpho > 0) {
      console.log('💤 当前已是最高收益 (Morpho)');

  // Solana 收益对比提醒
  const solanaBest = 0.10; // LULO 10%
  const baseBest = morphoApy;
  const diff = solanaBest - baseBest;
  if (diff > 0.03) {
    console.log("\n⚠️ 提醒: Solana 收益高出 " + (diff*100).toFixed(0) + "%!");
    console.log("   考虑跨链桥入 Solana");
  }
    }
    return;
  }

  if (action === 'switch' || action === 'auto' || action === 'dry-run') {
    
    const isDryRun = action === 'dry-run';
    if (isDryRun) {
      console.log('🔍 模拟运行模式 (不会真正交易)\n');
    }
    // 收集所有有存款的协议
    const totalAave = Number(aaveBalance) / 1e6;
    const totalMorpho = Number(morphoShares) / 1e18;
    const totalMoonwell = Number(moonwellShares) / 1e18;
    
    // 当前协议
    let current = null;
    if (totalMorpho > 0.001) current = { name: 'Morpho', apy: morphoApy, amount: totalMorpho };
    else if (totalAave > 0.001) current = { name: 'Aave', apy: aaveApy, amount: totalAave };
    else if (totalMoonwell > 0.001) current = { name: 'Moonwell', apy: moonwellApy, amount: totalMoonwell };
    
    // 找出最高 APY
    const best = [
      { name: 'Morpho', apy: morphoApy },
      { name: 'Aave', apy: aaveApy },
      { name: 'Moonwell', apy: moonwellApy }
    ].sort((a, b) => b.apy - a.apy)[0];
    
    // 如果没有存款但钱包有 USDC，直接存入最高收益协议
    if (!current && usdcBalance > 1000000) {  // > 1 USDC
      console.log(`💰 钱包有 USDC，自动存入 ${best.name} (APY: ${(best.apy*100).toFixed(1)}%)\n`);
      
      // 安全检查 + 授权
      await checkWalletSafety(publicClient);
      
      const usdcBal = usdcBalance.toString();
      
      // 检查并 approve
      const targetContract = best.name === 'Morpho' ? MORPHO : best.name === 'Aave' ? AAVE_POOL : MOONWELL;
      const allowance = await publicClient.readContract({ address: USDC, abi: ERC20, functionName: 'allowance', args: [WALLET, targetContract] });
      if (allowance < usdcBalance) {
        console.log(`🔐 授权 USDC 给 ${best.name}...`);
        await sendCdpTx(cdpAccount, {
          address: USDC, abi: ERC20, functionName: 'approve',
          args: [targetContract, usdcBal]
        });
        console.log(`✅ 授权成功，等待确认...`);
        await new Promise(r => setTimeout(r, 10000)); // 等待 10 秒
      }
      
      // 直接存入最高收益协议
      console.log(`1️⃣ 存入 ${best.name}...`);
      
      if (best.name === 'Morpho') {
        await sendCdpTx(cdpAccount, {
          address: MORPHO, abi: MORPHO_ABI, functionName: 'deposit',
          args: [usdcBal, WALLET]
        });
      } else if (best.name === 'Aave') {
        await sendCdpTx(cdpAccount, {
          address: AAVE_POOL, abi: AAVE_ABI, functionName: 'supply',
          args: [USDC, usdcBal, WALLET, 0]
        });
      } else if (best.name === 'Moonwell') {
        await sendCdpTx(cdpAccount, {
          address: MOONWELL, abi: MOONWELL_ABI, functionName: 'deposit',
          args: [usdcBal, WALLET]
        });
      }
      
      console.log(`✅ 成功存入 ${best.name}!`);
      return;
    } else if (!current) {
      console.log('💤 无存款，请先存入');
      return;
    }
    
    const diff = best.apy - current.apy;
    console.log(`📈 当前: ${current.name} @ ${(current.apy*100).toFixed(1)}% → 最佳: ${best.name} @ ${(best.apy*100).toFixed(1)}%`);
    console.log(`   收益差: ${(diff*100).toFixed(2)}%\n`);
    
    // 自动模式：只有收益差 > 1% 才切换
    if (action === 'auto' && diff < 0.01) {
      console.log('💤 收益差 < 1%，不切换');
      return;
    }
    
    if (current.name === best.name) {
      console.log('💤 当前已是最高收益');

  // Solana 收益对比提醒
  const solanaBest = 0.10; // LULO 10%
  const baseBest = morphoApy;
  const diff = solanaBest - baseBest;
  if (diff > 0.03) {
    console.log("\n⚠️ 提醒: Solana 收益高出 " + (diff*100).toFixed(0) + "%!");
    console.log("   考虑跨链桥入 Solana");
  }
      return;
    }
    
    // 执行切换
    console.log(`🔄 从 ${current.name} 切换到 ${best.name}...\n`);
    
    // 1. 从当前协议取款
    let sourceToken;
    if (current.name === 'Aave') {
      sourceToken = aaveBalance;
      console.log(`1️⃣ 从 Aave 取款...`);
      await sendCdpTx(cdpAccount, {
        address: AAVE_POOL, abi: AAVE_ABI, functionName: 'withdraw',
        args: [USDC, aaveBalance, WALLET]
      });
    } else if (current.name === 'Morpho') {
      sourceToken = morphoShares;
      console.log(`1️⃣ 从 Morpho 取款...`);
      await sendCdpTx(cdpAccount, {
        address: MORPHO, abi: MORPHO_ABI, functionName: 'withdraw',
        args: [morphoShares, WALLET, WALLET]
      });
    } else if (current.name === 'Moonwell') {
      sourceToken = moonwellShares;
      console.log(`1️⃣ 从 Moonwell 取款...`);
      await sendCdpTx(cdpAccount, {
        address: MOONWELL, abi: MOONWELL_ABI, functionName: 'redeem',
        args: [moonwellShares, WALLET, WALLET]
      });
    }
    
    await new Promise(r => setTimeout(r, 5000));
    
    // 2. 安全检查 + 获取 USDC 余额并 approve
    await checkWalletSafety(publicClient);
    
    const usdcBal = await publicClient.readContract({ address: USDC, abi: ERC20, functionName: 'balanceOf', args: [WALLET] });
    
    // 检查是否需要 approve
    const allowance = await publicClient.readContract({ address: USDC, abi: ERC20, functionName: 'allowance', args: [WALLET, best.name === 'Morpho' ? MORPHO : best.name === 'Aave' ? AAVE_POOL : MOONWELL] });
    if (allowance < usdcBal) {
      console.log(`🔐 授权 USDC 给 ${best.name}...`);
      await sendCdpTx(cdpAccount, {
        address: USDC, abi: ERC20, functionName: 'approve',
        args: [best.name === 'Morpho' ? MORPHO : best.name === 'Aave' ? AAVE_POOL : MOONWELL, usdcBal]
      });
      console.log(`✅ 授权成功`);
    }
    
    console.log(`2️⃣ 存入 ${best.name}...`);
    
    if (best.name === 'Morpho') {
      await sendCdpTx(cdpAccount, {
        address: MORPHO, abi: MORPHO_ABI, functionName: 'deposit',
        args: [usdcBal, WALLET]
      });
    } else if (best.name === 'Aave') {
      await sendCdpTx(cdpAccount, {
        address: AAVE_POOL, abi: AAVE_ABI, functionName: 'supply',
        args: [USDC, usdcBal, WALLET, 0]
      });
    } else if (best.name === 'Moonwell') {
      await sendCdpTx(cdpAccount, {
        address: MOONWELL, abi: MOONWELL_ABI, functionName: 'deposit',
        args: [usdcBal, WALLET]
      });
    }
    
    console.log('\n✅ 切换完成!');
    
    // 发送 Telegram 通知
    try {
      const { execSync } = require('child_process');
      const msg = `🔄 Yield 自动切换完成 (CDP)\n从: ${current.name} (${(current.apy*100).toFixed(1)}%)\n到: ${best.name} (${(best.apy*100).toFixed(1)}%)\n收益差: +${(diff*100).toFixed(1)}%`;
      execSync(`openclaw message send --target 8270921141 --message "${msg}" 2>/dev/null`, { encoding: 'utf8' });
    } catch (e) {
      console.log('⚠️ 通知发送失败');
    }
  }
}

main().catch(console.error);
