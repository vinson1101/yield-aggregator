import { CdpClient } from '@coinbase/cdp-sdk';
import { encodeFunctionData, parseAbi } from 'viem';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.cdp' });

const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const AAVE_POOL = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5';

const AAVE_ABI = parseAbi([
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to)',
  'function getUserAccountData(address user) view returns (uint256, uint256, uint256, uint256, uint256, uint256)'
]);

async function main() {
  const action = process.argv[2] || 'status';
  const amount = process.argv[3] || '0';

  console.log('=== CDP Executor (Aave) ===');
  console.log(`Action: ${action}, Amount: ${amount}\n`);

  try {
    const cdp = new CdpClient({
      apiKeyId: process.env.CDP_API_KEY_ID!,
      apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    });

    // 使用 F0x Smart Account
    const SMART_ACCOUNT = '0x125379c903a4e90529a6dcde40554418fa200399';
    
    // 获取 Smart Account
    const accountInfo = await cdp.evm.listSmartAccounts();
    const smartAcc = accountInfo.accounts.find(a => 
      a.address.toLowerCase() === SMART_ACCOUNT.toLowerCase()
    );
    
    if (!smartAcc) {
      console.log('❌ 未找到 Smart Account');
      return;
    }
    
    const owner = smartAcc.owners?.[0];
    if (!owner) {
      console.log('❌ 未找到 Owner');
      return;
    }
    
    console.log('Smart Account:', smartAcc.address);
    console.log('Owner:', owner);
    
    // 获取 account with owner
    const ownerAccount = await cdp.evm.getAccount({ address: owner });
    const smartAccount = await cdp.evm.getSmartAccount({
      address: SMART_ACCOUNT as `0x${string}`,
      owner: ownerAccount,
    });
    
    const baseAccount = smartAccount.useNetwork('base');
    const address = smartAccount.address;
    
    console.log('Base Address:', address);
    console.log('');

    if (action === 'status') {
      console.log('📊 查询 Aave 状态...');
      
      const data = await baseAccount.readContract({
        address: AAVE_POOL as `0x${string}`,
        abi: AAVE_ABI,
        functionName: 'getUserAccountData',
        args: [address as `0x${string}`]
      });
      
      console.log('Aave Position:');
      console.log(`  抵押: $${Number(data[0]) / 1e8}`);
      console.log(`  债务: $${Number(data[1]) / 1e8}`);
      console.log(`  可借: $${Number(data[2]) / 1e8}`);
      
    } else if (action === 'deposit') {
      const usdcAmount = BigInt(Math.floor(parseFloat(amount) * 1e6));
      
      console.log(`💰 存入 ${amount} USDC 到 Aave...`);
      
      const calldata = encodeFunctionData({
        abi: AAVE_ABI,
        functionName: 'supply',
        args: [USDC_ADDRESS as `0x${string}`, usdcAmount, address as `0x${string}`, 0n]
      });
      
      const result = await baseAccount.sendUserOperation({
        calls: [{
          to: AAVE_POOL as `0x${string}`,
          data: calldata,
          value: 0n
        }]
      });
      
      console.log(`✅ 存款提交!`);
      console.log(`   UserOp: ${result.userOpHash}`);
      console.log(`   等待确认...`);
      
    } else if (action === 'withdraw') {
      const usdcAmount = amount === 'max' ? 2n ** 256n - 1n : BigInt(Math.floor(parseFloat(amount) * 1e6));
      
      console.log(`💰 从 Aave 取款 ${amount} USDC...`);
      
      const calldata = encodeFunctionData({
        abi: AAVE_ABI,
        functionName: 'withdraw',
        args: [USDC_ADDRESS as `0x${string}`, usdcAmount, address as `0x${string}`]
      });
      
      const result = await baseAccount.sendUserOperation({
        calls: [{
          to: AAVE_POOL as `0x${string}`,
          data: calldata,
          value: 0n
        }]
      });
      
      console.log(`✅ 取款提交!`);
      console.log(`   UserOp: ${result.userOpHash}`);
    }

  } catch (error: any) {
    console.log(`❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

main();
