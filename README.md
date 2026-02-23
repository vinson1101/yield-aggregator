# Yield Aggregator

Auto-switch DeFi yield optimization for Base chain.

## Features

- Scan Aave and Morpho interest rates
- Auto-switch to higher yield protocol
- Daily yield monitoring via cron

## Usage

```bash
# Check yields
node bin/rebalance.cjs check

# Switch (manual)
node bin/rebalance.cjs switch
```

## Supported Protocols

- Aave V3 (Base): ~3.5% APY
- Morpho Blue (Base): ~9.8% APY

## Configuration

Edit `bin/rebalance.cjs` to change wallet address and protocols.

## Status

- ✅ Rate check working
- ✅ Manual switch working  
- ⚠️ Auto-switch (CDP SDK bug - using EOA for now)
