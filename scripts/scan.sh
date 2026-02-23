#!/bin/bash
# Yield Scanner - Phase 1
# 查询 Base 链借贷利率

echo "=== Base USDC Yield Scanner ==="
echo ""

# 查询 Base 链 USDC 收益机会
echo "📊 查询 Base 链 USDC 收益机会..."
defi yield opportunities --chain base --asset USDC --limit 10 --results-only 2>/dev/null

echo ""
echo "📊 查询 Aave Base USDC 利率..."
defi lend rates --protocol aave --chain base --asset USDC --results-only 2>/dev/null

echo ""
echo "📊 查询 Morpho Base USDC 利率..."
defi lend rates --protocol morpho --chain base --asset USDC --results-only 2>/dev/null
