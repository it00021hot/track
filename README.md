# 链上巨鲸 - 加密货币大额成交监控

一个纯前端的加密货币大额成交监控网站，实时追踪比特币、以太坊、Solana 在 Binance 交易所的大额交易。

![链上巨鲸](https://img.shields.io/badge/链上巨鲸-大额成交监控-primary?style=for-the-badge)
![纯前端](https://img.shields.io/badge/技术栈-纯前端-success?style=for-the-badge)
![GitHub Pages](https://img.shields.io/badge/部署-GitHub%20Pages-blue?style=for-the-badge)

## 功能特性

- 多链支持：Bitcoin (BTC)、Ethereum (ETH)、Solana (SOL)
- 实时监控：自动每 1 分钟更新数据
- 动态排行：按金额或时间排序
- 交易详情：点击卡片展开完整成交信息
- 响应式设计：完美支持桌面、平板、移动设备
- 暗色主题：专业科技风格设计
- 零依赖：无需后端，纯静态网站
- 完全免费：使用 Binance 公共 API，无需 API Key

## 技术架构

- **前端框架**：纯 HTML + 原生 JavaScript
- **样式方案**：Tailwind CSS (CDN)
- **数据源**：[Binance 公共 API](https://binance-docs.github.io/apidocs/spot/cn/)（完全免费，无需注册）
- **部署**：GitHub Pages

## 关于数据

本项目展示的是 **Binance 交易所内的大额成交数据**，而非链上转账交易。

### 数据特点

- ✅ **完全免费**：无需 API Key，无请求限制
- ✅ **实时更新**：数据直接来自 Binance 交易所
- ✅ **真实成交**：展示的是交易所内实际发生的大额交易
- ⚠️ **非链上数据**：这是交易所内成交，不是区块链转账

### 为什么展示交易所成交？

1. **API 限制**：大多数区块链浏览器 API 需要 API Key 或有严格的 CORS 限制
2. **数据质量**：Binance API 完全免费、稳定、支持 CORS
3. **实用价值**：交易所大额成交往往反映市场情绪和巨鲸动向

## 快速开始

### 本地开发

1. 克隆仓库
```bash
git clone https://github.com/your-username/btc_data.git
cd btc_data
```

2. 启动本地服务器
```bash
# 使用 Python
python3 -m http.server 8000

# 或使用 Node.js
npx http-server

# 或使用 PHP
php -S localhost:8000
```

3. 访问 http://localhost:8000

### 部署到 GitHub Pages

1. 将代码推送到 GitHub 仓库

2. 在仓库设置中启用 GitHub Pages：
   - 进入 Settings → Pages
   - Source 选择 "Deploy from a branch"
   - Branch 选择 "main" / "root"
   - 点击 Save

3. 访问 `https://your-username.github.io/btc_data/`

## 项目结构

```
btc_data/
├── index.html              # 主页面
├── 404.html                # 404 页面
├── assets/
│   ├── css/
│   │   └── styles.css      # 自定义样式
│   └── js/
│       ├── api.js          # API 封装
│       ├── binance.js      # Binance API 统一封装
│       ├── cache.js        # 缓存管理
│       ├── bitcoin.js      # BTC 数据获取
│       ├── ethereum.js     # ETH 数据获取
│       ├── solana.js       # SOL 数据获取
│       └── app.js          # 主应用逻辑
└── README.md               # 项目说明
```

## API 数据源

### Binance 公共 API

本项目使用 [Binance Spot API](https://binance-docs.github.io/apidocs/spot/cn/) 的公共端点：

| 端点 | 说明 |
|------|------|
| `/api/v3/trades` | 获取最近成交列表 |
| `/api/v3/ticker/price` | 获取最新价格 |
| `/api/v3/ticker/24hr` | 获取 24 小时价格变动统计 |

**优势**：
- ✅ 完全免费，无需注册
- ✅ 无请求频率限制
- ✅ 支持 CORS
- ✅ 数据实时准确

## 自定义配置

### 修改大额交易门槛

编辑 `assets/js/binance.js`：
```javascript
minUSD: 100000, // $100,000
```

### 修改自动刷新间隔

编辑 `assets/js/app.js`：
```javascript
setInterval(() => {
    this.loadData(true);
}, 5 * 60 * 1000); // 5 分钟
```

### 修改缓存时间

编辑 `assets/js/binance.js` 中的缓存时间：
```javascript
Cache.set(cacheKey, sortedTxs, 60 * 1000); // 1 分钟
```

## 设计特色

### 视觉风格
- Dark Mode (OLED) + Glassmorphism
- 琥珀金色 (#F59E0B) 主色调
- 毛玻璃效果导航栏
- 平滑动画过渡

### 字体方案
- **标题**: Space Grotesk (科技感)
- **正文**: DM Sans (高可读性)

### 响应式布局
- 移动端 (< 768px): 单列
- 平板 (768px - 1024px): 双列
- 桌面 (> 1024px): 三列

## 浏览器支持

- Chrome/Edge (推荐)
- Firefox
- Safari
- Opera

## 常见问题

### Q: 为什么显示的是交易所成交而不是链上转账？

**A**:
1. 区块链浏览器 API 大多需要付费 API Key
2. Binance 公共 API 完全免费且稳定
3. 交易所大额成交同样反映巨鲸动向

### Q: 数据是实时的吗？

**A**: 是的，数据直接来自 Binance 交易所，实时更新。页面默认每 5 分钟自动刷新。

### Q: 如何获取更高的数据量？

**A**:
- 本项目从最近 1000 条成交中筛选大额交易
- 可修改 `limit` 参数获取更多数据
- Binance API 无频率限制

## 注意事项

### 数据来源
- 数据来自 Binance 交易所公共 API
- 仅用于展示和分析，不构成投资建议
- 请遵守 Binance API 使用条款

### 隐私安全
- 不收集任何用户数据
- 所有数据直接从 Binance API 获取
- 无需登录或注册

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

- [Tailwind CSS](https://tailwindcss.com/)
- [Binance API](https://binance-docs.github.io/apidocs/spot/cn/)
- [Heroicons](https://heroicons.com/)

---

**免责声明**: 本项目仅用于展示加密货币交易所成交信息，不构成任何投资建议。
