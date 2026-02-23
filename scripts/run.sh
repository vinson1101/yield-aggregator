#!/bin/bash
# Complete Yield Aggregator - All in One
# 扫描 -> 判断 -> 执行

WALLET=${WALLET_ADDRESS:-"0x145177cd8f0AD7aDE30de1CF65B13f5f45E19e91"}
THRESHOLD_BASE=3
THRESHOLD_TOTAL=10
LOG_FILE="/root/.openclaw/workspace/yield-aggregator/logs/$(date +%Y-%m-%d).log"

mkdir -p /root/.openclaw/workspace/yield-aggregator/logs

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Yield Aggregator Run ==="

# 扫描 Aave
log "📊 扫描 Aave..."
AAVE_DATA=$(defi lend rates --protocol aave --chain base --asset USDC --results-only 2>/dev/null)
AAVE_RATE=$(echo "$AAVE_DATA" | jq -r '.[0].supply_apy // "0"')

# 扫描 Morpho
log "📊 扫描 Morpho..."
MORPHO_DATA=$(defi lend rates --protocol morpho --chain base --asset USDC --results-only 2>/dev/null)
MORPHO_RATE=$(echo "$MORPHO_DATA" | jq -r '.[0].supply_apy // "0"')

log "Aave: ${AAVE_RATE}%, Morpho: ${MORPHO_RATE}%"

# 取较高者
CURRENT_PROTOCOL="aave"
CURRENT_RATE=$AAVE_RATE
CURRENT_TOTAL=$AAVE_RATE

if (( $(echo "$MORPHO_RATE > $AAVE_RATE" | bc -l) )); then
    CURRENT_PROTOCOL="morpho"
    CURRENT_RATE=$MORPHO_RATE
    CURRENT_TOTAL=$MORPHO_RATE
fi

log "当前: $CURRENT_PROTOCOL @ ${CURRENT_RATE}%"

# 扫描最佳
log "📊 扫描最佳借贷..."
YIELD_DATA=$(defi yield opportunities --chain base --asset USDC --limit 30 --results-only 2>/dev/null)

BEST_PROTOCOL=$(echo "$YIELD_DATA" | jq -r '[.[] | select(.type=="lend")] | max_by(.apy_total) | .protocol')
BEST_BASE=$(echo "$YIELD_DATA" | jq -r '[.[] | select(.type=="lend")] | max_by(.apy_total) | .apy_base')
BEST_REWARD=$(echo "$YIELD_DATA" | jq -r '[.[] | select(.type=="lend")] | max_by(.apy_total) | .apy_reward')
BEST_TOTAL=$(echo "$YIELD_DATA" | jq -r '[.[] | select(.type=="lend")] | max_by(.apy_total) | .apy_total')
BEST_TVL=$(echo "$YIELD_DATA" | jq -r '[.[] | select(.type=="lend")] | max_by(.apy_total) | .tvl_usd')

log "最佳: $BEST_PROTOCOL (base: $BEST_BASE%, reward: $BEST_REWARD%, total: $BEST_TOTAL%, TVL: $BEST_TVL)"

# 判断
DIFF_BASE=$(echo "$BEST_BASE - $CURRENT_RATE" | bc -l 2>/dev/null || echo "0")
DIFF_TOTAL=$(echo "$BEST_TOTAL - $CURRENT_TOTAL" | bc -l 2>/dev/null || echo "0")

log "差异: base ${DIFF_BASE}%, total ${DIFF_TOTAL}%"

# 执行
if (( $(echo "$DIFF_BASE > $THRESHOLD_BASE" | bc -l) )) || (( $(echo "$DIFF_TOTAL > $THRESHOLD_TOTAL" | bc -l) )); then
    log "🎯 触发切换！$CURRENT_PROTOCOL -> $BEST_PROTOCOL"
    log "⚠️ 执行功能待完成"
else
    log "✅ 无需切换 (当前最优)"
fi

log "=== Complete ==="
