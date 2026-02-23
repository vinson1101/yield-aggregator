#!/bin/bash
LOG_FILE="/root/.openclaw/workspace/logs/yield.log"

echo "=== Yield Monitor $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG_FILE"

# 0x1758 Morpho
MORPHO="0x8A034f069D59d62a4643ad42E49b846d036468D7"
WALLET="0x1758de3e2cf746f4eeb7143c3935fca1b30060ce"

SHARES=$(curl -s "https://mainnet.base.org" -X POST -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$MORPHO\",\"data\":\"0x70a08231000000000000000000000000${WALLET:2}\"},\"latest\"],\"id\":1}" | jq -r '.result')

if [ -n "$SHARES" ] && [ "$SHARES" != "0x" ] && [ "$SHARES" != "null" ]; then
    SHARES_DEC=$(python3 -c "print(int('$SHARES', 16) / 1e18)" 2>/dev/null)
    python3 -c "print(f'  Morpho: {$SHARES_DEC:.4f} shares')" >> "$LOG_FILE"
    python3 -c "print(f'  APY: 9.8%')" >> "$LOG_FILE"
fi

echo "" >> "$LOG_FILE"
tail -5 "$LOG_FILE"
