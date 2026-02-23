#!/bin/bash
# Yield Rebalancer - Phase 2
# 自动切换到更高收益的池子

WALLET="0x145177cd8f0AD7aDE30de1CF65B13f5f45E19e91"
USDC="0x833589fCD6edb6E08f4c7C32D4f71b54bdA02913"

echo "=== Yield Rebalancer ==="
echo "Wallet: $WALLET"
echo ""

# 1. 获取当前持仓利率
echo "📊 当前持仓..."
# 假设当前在 Aave
CURRENT_RATE=3.17
CURRENT_PROTOCOL="aave"

# 2. 扫描最佳利率
echo "📊 扫描最佳利率..."
BEST=$(defi yield opportunities --chain base --asset USDC --limit 5 --results-only 2>/dev/null | jq -r '.[] | select(.type=="lend") | .apy_total' | head -1)
BEST_PROTOCOL=$(defi yield opportunities --chain base --asset USDC --limit 5 --results-only 2>/dev/null | jq -r '.[] | select(.type=="lend") | .protocol' | head -1)

echo "当前: $CURRENT_PROTOCOL @ ${CURRENT_RATE}%"
echo "最佳: $BEST_PROTOCOL @ ${BEST}%"

# 3. 判断是否切换
THRESHOLD=2  # 超过 2% 才切换

if (( $(echo "$BEST > $CURRENT_RATE + $THRESHOLD" | bc -l) )); then
    echo ""
    echo "🎯 发现更好的机会！触发切换"
    echo "从 $CURRENT_PROTOCOL ($CURRENT_RATE%) -> $BEST_PROTOCOL ($BEST%)"
    
    # TODO: 执行切换脚本
    # 需要调用 CDP/Aave 合约
else
    echo ""
    echo "✅ 无需切换，当前 ${CURRENT_RATE}% 仍然是最佳选择"
fi
