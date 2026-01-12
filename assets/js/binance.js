/**
 * Binance API 统一封装
 * Binance 提供免费的公共 API，无需 API Key
 * API 文档: https://binance-docs.github.io/apidocs/spot/cn/
 */

const Binance = {
    // API 基础 URL
    baseURL: 'https://api.binance.com',

    // 交易对映射
    symbols: {
        btc: 'BTCUSDT',
        eth: 'ETHUSDT',
        sol: 'SOLUSDT'
    },

    // 链名称映射
    chainNames: {
        btc: 'Bitcoin',
        eth: 'Ethereum',
        sol: 'Solana'
    },

    // 最小成交金额（USDT）
    minUSD: 100000, // $100,000

    // 区块链浏览器 URL
    explorerUrls: {
        btc: (hash) => `https://blockstream.info/tx/${hash}`,
        eth: (hash) => `https://etherscan.io/tx/${hash}`,
        sol: (hash) => `https://solscan.io/tx/${hash}`
    },

    /**
     * 调用 Binance API
     * @param {string} endpoint - 端点路径
     * @returns {Promise<object>} API 响应
     */
    async callAPI(endpoint) {
        const url = `${this.baseURL}${endpoint}`;

        try {
            const response = await API.fetchWithRetry(url);
            return response;
        } catch (error) {
            console.error(`Binance API 调用失败:`, error);
            return [];
        }
    },

    /**
     * 获取大额交易（从最近成交中筛选）
     * @param {string} chain - 链标识 (btc, eth, sol)
     * @param {number} limit - 返回数量
     * @returns {Promise<Array>} 交易列表
     */
    async getLargeTransactions(chain, limit = 20) {
        const cacheKey = `binance_${chain}_transactions_${limit}`;

        // 检查缓存
        const cached = Cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const symbol = this.symbols[chain];
            if (!symbol) {
                throw new Error(`不支持的链: ${chain}`);
            }

            // 获取最近成交（获取更多数据用于筛选）
            const trades = await this.callAPI(`/api/v3/trades?symbol=${symbol}&limit=1000`);

            // 获取当前价格用于计算
            const ticker = await this.callAPI(`/api/v3/ticker/price?symbol=${symbol}`);
            const currentPrice = parseFloat(ticker.price);

            // 处理成交数据
            const processedTxs = this.processTrades(chain, trades, currentPrice);

            // 按金额排序并限制数量
            const sortedTxs = processedTxs
                .sort((a, b) => b.amountUsd - a.amountUsd)
                .slice(0, limit);

            // 缓存结果（1 分钟）
            Cache.set(cacheKey, sortedTxs, 60 * 1000);

            return sortedTxs;
        } catch (error) {
            console.error(`获取 ${chain} 大额交易失败:`, error);
            return [];
        }
    },

    /**
     * 处理成交数据
     * @param {string} chain - 链标识
     * @param {Array} trades - 原始成交数据
     * @param {number} currentPrice - 当前价格
     * @returns {Array} 处理后的交易列表
     */
    processTrades(chain, trades, currentPrice) {
        const processed = [];

        for (const trade of trades) {
            try {
                const price = parseFloat(trade.price);
                const qty = parseFloat(trade.qty);
                const quoteQty = parseFloat(trade.quoteQty); // USDT 金额
                const time = trade.time;

                // 只保留大额交易
                if (quoteQty < this.minUSD) {
                    continue;
                }

                // 计算原生代币数量
                const amountNative = qty;

                // 生成模拟交易 ID（Binance 成交数据没有真实的链上交易哈希）
                const tradeId = `binance_${chain}_${trade.id}`;

                // 判断买卖方向
                const isBuyerMaker = trade.isBuyerMaker;
                const from = isBuyerMaker ? 'Binance Seller' : 'Binance Buyer';
                const to = isBuyerMaker ? 'Binance Buyer' : 'Binance Seller';

                processed.push({
                    id: tradeId,
                    hash: tradeId,
                    chain: chain,
                    network: this.chainNames[chain],
                    amountNative: amountNative,
                    amountUsd: quoteQty,
                    from: from,
                    to: to,
                    feeNative: 0,
                    feeUsd: 0,
                    timestamp: new Date(time),
                    blockHeight: 0,
                    blockHash: '',
                    confirmations: 0,
                    explorerUrl: `https://www.binance.com/en/trade/${this.symbols[chain]}`,
                    isExchangeTrade: true, // 标记为交易所成交
                    price: price
                });
            } catch (error) {
                console.error('处理成交数据失败:', error);
                continue;
            }
        }

        return processed;
    },

    /**
     * 获取价格
     * @param {string} chain - 链标识
     * @returns {Promise<number>} 当前价格（USD）
     */
    async getPrice(chain) {
        const cacheKey = `binance_${chain}_price`;

        // 检查缓存
        const cached = Cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const symbol = this.symbols[chain];
            const ticker = await this.callAPI(`/api/v3/ticker/price?symbol=${symbol}`);
            const price = parseFloat(ticker.price);

            // 缓存价格（1 分钟）
            Cache.set(cacheKey, price, 60 * 1000);

            return price;
        } catch (error) {
            console.error(`获取 ${chain} 价格失败:`, error);
            // 返回默认价格
            const defaultPrices = { btc: 95000, eth: 3200, sol: 240 };
            return defaultPrices[chain] || 0;
        }
    },

    /**
     * 获取 24 小时统计
     * @param {string} chain - 链标识
     * @returns {Promise<object>} 24小时统计数据
     */
    async get24hStats(chain) {
        try {
            const symbol = this.symbols[chain];
            const stats = await this.callAPI(`/api/v3/ticker/24hr?symbol=${symbol}`);
            return {
                priceChange: parseFloat(stats.priceChange),
                priceChangePercent: parseFloat(stats.priceChangePercent),
                high: parseFloat(stats.highPrice),
                low: parseFloat(stats.lowPrice),
                volume: parseFloat(stats.volume),
                quoteVolume: parseFloat(stats.quoteVolume)
            };
        } catch (error) {
            console.error(`获取 ${chain} 24小时统计失败:`, error);
            return null;
        }
    }
};

// 导出为全局变量（用于非模块环境）
if (typeof window !== 'undefined') {
    window.Binance = Binance;
}
