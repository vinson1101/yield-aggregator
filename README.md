# Yield Aggregator

Auto-switch DeFi yield optimization for Base chain.

## Features

- Scan Aave and Morpho interest rates
- Auto-switch to higher yield protocol
- Daily yield monitoring via cron
- CDP Smart Account support (default)

## Usage

```bash
# Check yields (uses CDP by default)
node bin/rebalance.cjs check

# Switch (manual)
node bin/rebalance.cjs switch
```

## CDP Smart Account

Default wallet: `0x5Bae0994344d22E0a3377e81204CC7c030c65e96`
Owner: `0x145177cd8f0AD7aDE30de1CF65B13f5f45E19e91`

## Supported Protocols

- Aave V3 (Base): ~3.5% APY
- Morpho Blue (Base): ~9.8% APY

## Configuration

Edit `bin/rebalance.cjs` to change wallet address and protocols.

## Status

- ✅ Rate check working (CDP)
- ✅ Manual switch working (CDP)
- ✅ Auto-switch working (CDP)
