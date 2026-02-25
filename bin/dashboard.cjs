#!/usr/bin/env node
/**
 * Yield Dashboard - Web 界面
 */

const http = require('http');
const fs = require('fs');

const PORT = 3838;
const STATE_FILE = '/root/.openclaw/workspace/yield-aggregator/data/state.json';
const HISTORY_FILE = '/root/.openclaw/workspace/yield-aggregator/data/history.json';

function getHTML() {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8').replace(/\n$/, ''));
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8').replace(/\n$/, ''));
  
  // 计算收益
  const morphoShares = 1.2748;
  const morphoApy = 0.122;
  const currentValue = morphoShares * 3.92; // 估算
  const dailyYield = (5 * morphoApy) / 365;
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Yield Aggregator Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; min-height: 100vh; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
    .card { background: #161b22; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #30363d; }
    .card h2 { color: #8b949e; font-size: 14px; text-transform: uppercase; margin-bottom: 15px; }
    .stat { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #30363d; }
    .stat:last-child { border-bottom: none; }
    .stat-label { color: #8b949e; }
    .stat-value { font-size: 20px; font-weight: bold; }
    .stat-value.green { color: #3fb950; }
    .stat-value.yellow { color: #d29922; }
    .stat-value.red { color: #f85149; }
    .protocol { display: flex; align-items: center; gap: 15px; padding: 15px; background: #21262d; border-radius: 8px; margin-bottom: 10px; }
    .protocol-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .protocol-info { flex: 1; }
    .protocol-name { font-weight: bold; font-size: 16px; }
    .protocol-apy { color: #8b949e; font-size: 14px; }
    .protocol-amount { font-size: 18px; font-weight: bold; }
    .current { border: 2px solid #3fb950; }
    .btn { background: #238636; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; text-decoration: none; display: inline-block; }
    .btn:hover { background: #2ea043; }
    .btn-secondary { background: #21262d; }
    .btn-secondary:hover { background: #30363d; }
    .history-item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #30363d; }
    .history-item:last-child { border-bottom: none; }
    .time { color: #8b949e; font-size: 12px; }
    .footer { text-align: center; color: #8b949e; margin-top: 30px; font-size: 12px; }
    .refresh { float: right; font-size: 12px; color: #8b949e; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🦞 Yield Aggregator <span class="refresh">Auto-refresh: 60s</span></h1>
    
    <div class="card">
      <h2>📊 当前状态</h2>
      <div class="stat">
        <span class="stat-label">本金</span>
        <span class="stat-value">$5.00 USDC</span>
      </div>
      <div class="stat">
        <span class="stat-label">当前协议</span>
        <span class="stat-value green">Morpho</span>
      </div>
      <div class="stat">
        <span class="stat-label">当前 APY</span>
        <span class="stat-value green">12.2%</span>
      </div>
      <div class="stat">
        <span class="stat-label">日收益</span>
        <span class="stat-value green">$${dailyYield.toFixed(4)}</span>
      </div>
      <div class="stat">
        <span class="stat-label">年收益</span>
        <span class="stat-value green">$${(5 * morphoApy).toFixed(2)}</span>
      </div>
    </div>
    
    <div class="card">
      <h2>📈 协议对比</h2>
      <div class="protocol current">
        <div class="protocol-icon" style="background: #7c3aed;">🦞</div>
        <div class="protocol-info">
          <div class="protocol-name">Morpho</div>
          <div class="protocol-apy">12.2% APY ✅ 当前</div>
        </div>
        <div class="protocol-amount">1.27 shares</div>
      </div>
      <div class="protocol">
        <div class="protocol-icon" style="background: #ef4444;">🌙</div>
        <div class="protocol-info">
          <div class="protocol-name">Moonwell</div>
          <div class="protocol-apy">3.8% APY</div>
        </div>
        <div class="protocol-amount">-</div>
      </div>
      <div class="protocol">
        <div class="protocol-icon" style="background: #3b82f6;">🔵</div>
        <div class="protocol-info">
          <div class="protocol-name">Aave</div>
          <div class="protocol-apy">3.4% APY</div>
        </div>
        <div class="protocol-amount">-</div>
      </div>
    </div>
    
    <div class="card">
      <h2>📜 收益历史</h2>
      ${history.slice(-5).reverse().map(h => `
        <div class="history-item">
          <span class="time">${new Date(h.time).toLocaleString()}</span>
          <span>${h.protocol}</span>
          <span class="green">${(h.apy * 100).toFixed(1)}%</span>
        </div>
      `).join('')}
    </div>
    
    <div class="card">
      <h2>🎮 操作</h2>
      <a href="/check" class="btn">🔄 刷新状态</a>
      <a href="/auto" class="btn btn-secondary">⚡ 自动切换</a>
      <a href="/dry-run" class="btn btn-secondary">🔍 模拟运行</a>
    </div>
    
    <div class="footer">
      Powered by PinchyMeow 🦞😺 | 最后更新: ${new Date().toLocaleString()}
    </div>
  </div>
  
  <script>
    setTimeout(() => location.reload(), 60000);
  </script>
</body>
</html>`;
  
  return html;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  try {
    if (req.url === '/' || req.url === '/index.html') {
      res.end(getHTML());
    } else if (req.url === '/check') {
      const { execSync } = require('child_process');
      const output = execSync('/root/.openclaw/workspace/yield-aggregator/bin/rebalance.cjs check 2>&1', { encoding: 'utf8' });
      res.end(`<pre>${output}</pre><a href="/">返回</a>`);
    } else if (req.url === '/auto') {
      const { execSync } = require('child_process');
      const output = execSync('/root/.openclaw/workspace/yield-aggregator/bin/rebalance.cjs auto 2>&1', { encoding: 'utf8' });
      res.end(`<pre>${output}</pre><a href="/">返回</a>`);
    } else if (req.url === '/dry-run') {
      const { execSync } = require('child_process');
      const output = execSync('/root/.openclaw/workspace/yield-aggregator/bin/rebalance.cjs dry-run 2>&1', { encoding: 'utf8' });
      res.end(`<pre>${output}</pre><a href="/">返回</a>`);
    } else {
      res.end('Not Found');
    }
  } catch (e) {
    res.end(`Error: ${e.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
});
