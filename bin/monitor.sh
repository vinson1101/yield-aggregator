#!/bin/bash
cd /root/.openclaw/workspace/yield-aggregator

# 安全检查
echo "=== 安全检查 ==="
python3 << 'PYEOF'
import requests

OWNER = '0x145177cd8f0AD7aDE30de1CF65B13f5f45E19e91'

resp = requests.post('https://mainnet.base.org', json={
    'jsonrpc': '2.0',
    'method': 'eth_getCode',
    'params': [OWNER, 'latest'],
    'id': 1
})
code = resp.json().get('result', '0x')

if code and code != '0x':
    print('⚠️ 安全警告: Owner 钱包已被攻击！检测到非零代码！')
    exit(1)
else:
    print('✅ 安全检查通过: Owner 是普通 EOA')
PYEOF

if [ $? -eq 0 ]; then
    # Yield 监控
    export CDP_OWNER_ADDRESS=0x145177cd8f0AD7aDE30de1CF65B13f5f45E19e91
    export CDP_SMART_ACCOUNT_ADDRESS=0x5Bae0994344d22E0a3377e81204CC7c030c65e96
    node bin/rebalance.cjs check
fi
