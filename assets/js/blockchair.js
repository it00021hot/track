/**
 * Blockchair 统一 API 封装
 * Blockchair 支持 Bitcoin, Ethereum, Solana 等多条公链
 * API 文档: https://blockchair.com/api/docs
 */

const Blockchair = {
    // API 基础 URL
    baseURL: 'https://api.blockchair.com',

    // API Key（可选，用户可通过 localStorage 设置）
    apiKey: localStorage.getItem('blockchair_api_key') || '',

    // 支持的链
    chains: {
        btc: 'bitcoin',
        eth: 'ethereum',
        sol: 'solana'
    },

    // 链名称映射
    chainNames: {
        btc: 'Bitcoin',
        eth: 'Ethereum',
        sol: 'Solana'
    },

    // 最小 USD 金额（筛选大额交易）
    minUSD: 100000, // $100,000

    // 区块链浏览器 URL
    explorerUrls: {
        btc: (txid) => `https://blockchair.com/bitcoin/transaction/${txid}`,
        eth: (txid) => `https://blockchair.com/ethereum/transaction/${txid}`,
        sol: (txid) => `https://blockchair.com/solana/transaction/${txid}`
    },

    /**
     * 调用 Blockchair API
     * @param {string} chain - 链标识 (btc, eth, sol)
     * @param {string} endpoint - 端点路径
     * @param {object} params - 查询参数
     * @returns {Promise<object>} API 响应
     */
    async callAPI(chain, endpoint, params = {}) {
        const chainName = this.chains[chain];
        if (!chainName) {
            throw new Error(`不支持的链: ${chain}`);
        }

        const url = new URL(`${this.baseURL}/${chainName}/${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        // 添加 API Key（如果有）
        if (this.apiKey) {
            url.searchParams.append('key', this.apiKey);
        }

        try {
            const response = await API.fetchWithRetry(url.toString());

            // 检查 API 响应状态
            if (response.context) {
                // 检查是否被限流
                if (response.context.code === 429 || response.context.code === 430) {
                    const errorMsg = response.context.error || 'API 请求频率超限';
                    console.warn(`Blockchair API 限流: ${errorMsg}`);
                    // 返回空数据而不是抛出错误
                    return { data: { transactions: {}, blocks: {} }, context: response.context };
                }
                // 检查其他错误
                if (response.context.error) {
                    throw new Error(response.context.error);
                }
            }

            return response;
        } catch (error) {
            console.error(`Blockchair API 调用失败 (${chain}):`, error);
            // 返回空数据而不是抛出错误，让应用继续运行
            return { data: { transactions: {}, blocks: {} }, context: { error: error.message } };
        }
    },

    /**
     * 获取大额交易
     * @param {string} chain - 链标识 (btc, eth, sol)
     * @param {number} limit - 返回数量
     * @returns {Promise<Array>} 交易列表
     */
    async getLargeTransactions(chain, limit = 20) {
        const cacheKey = `blockchair_${chain}_transactions_${limit}`;

        // 检查缓存
        const cached = Cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // 使用 dashboard API 获取最新交易
            // offset 参数用于分页
            const response = await this.callAPI(chain, 'dashboard', {
                transaction_state: 'r',
                limit: limit * 2, // 获取更多数据用于筛选
                offset: 0
            });

            const transactions = response.data?.transactions || {};
            const blocks = response.data?.blocks || {};

            // 处理交易数据
            const processedTxs = this.processTransactions(chain, transactions, blocks);

            // 按金额排序并限制数量
            const sortedTxs = processedTxs
                .sort((a, b) => b.amountUsd - a.amountUsd)
                .slice(0, limit);

            // 缓存结果（5 分钟）
            Cache.set(cacheKey, sortedTxs, 5 * 60 * 1000);

            return sortedTxs;
        } catch (error) {
            console.error(`获取 ${chain} 大额交易失败:`, error);
            return [];
        }
    },

    /**
     * 处理交易数据
     * @param {string} chain - 链标识
     * @param {object} transactions - 原始交易数据
     * @param {object} blocks - 区块数据
     * @returns {Array} 处理后的交易列表
     */
    processTransactions(chain, transactions, blocks) {
        const processed = [];

        // 遍历交易（Blockchair 返回的对象，key 是交易哈希）
        for (const [txHash, tx] of Object.entries(transactions)) {
            try {
                // 跳过没有 USD 价值的交易
                if (!tx.usd_value || tx.usd_value < this.minUSD) {
                    continue;
                }

                // 提取发送方和接收方
                const { from, to } = this.extractAddresses(chain, tx);

                processed.push({
                    id: txHash,
                    hash: txHash,
                    chain: chain,
                    network: this.chainNames[chain],
                    amountNative: this.extractNativeAmount(chain, tx),
                    amountUsd: tx.usd_value,
                    from: from,
                    to: to,
                    feeNative: this.extractFee(chain, tx),
                    feeUsd: tx.fee_usd || 0,
                    timestamp: new Date(tx.time * 1000),
                    blockHeight: tx.block_id,
                    blockHash: tx.block_hash || '',
                    confirmations: 0,
                    explorerUrl: this.explorerUrls[chain](txHash)
                });
            } catch (error) {
                console.error('处理交易失败:', error);
                continue;
            }
        }

        return processed;
    },

    /**
     * 提取发送方和接收方地址
     * @param {string} chain - 链标识
     * @param {object} tx - 交易数据
     * @returns {object} { from, to }
     */
    extractAddresses(chain, tx) {
        try {
            // Blockchair API 地址格式: "sender,receiver"
            if (tx.sending_address && tx.receiving_address) {
                return {
                    from: tx.sending_address,
                    to: tx.receiving_address
                };
            }

            // 备用方案：从 inputs/outputs 解析
            if (tx.inputs && tx.inputs.length > 0) {
                const from = tx.inputs[0]?.sending_address || 'Unknown';
                const to = tx.outputs?.[0]?.receiving_address || 'Unknown';
                return { from, to };
            }

            return { from: 'Unknown', to: 'Unknown' };
        } catch (error) {
            return { from: 'Unknown', to: 'Unknown' };
        }
    },

    /**
     * 提取原生代币金额
     * @param {string} chain - 链标识
     * @param {object} tx - 交易数据
     * @returns {number} 原生代币金额
     */
    extractNativeAmount(chain, tx) {
        switch (chain) {
            case 'btc':
                // Bitcoin: 转换 satoshi 到 BTC
                return (tx.output_total || 0) / 100000000;
            case 'eth':
                // Ethereum: 转换 wei 到 ETH
                return tx.output_total ? parseFloat(tx.output_total) / 1e18 : 0;
            case 'sol':
                // Solana: 转换 lamports 到 SOL
                return (tx.output_total || 0) / 1000000000;
            default:
                return tx.output_total || 0;
        }
    },

    /**
     * 提取手续费
     * @param {string} chain - 链标识
     * @param {object} tx - 交易数据
     * @returns {number} 手续费（原生代币）
     */
    extractFee(chain, tx) {
        switch (chain) {
            case 'btc':
                return (tx.fee || 0) / 100000000;
            case 'eth':
                return tx.fee ? parseFloat(tx.fee) / 1e18 : 0;
            case 'sol':
                return (tx.fee || 0) / 1000000000;
            default:
                return tx.fee || 0;
        }
    },

    /**
     * 获取链上价格信息
     * @param {string} chain - 链标识
     * @returns {Promise<number>} 当前价格（USD）
     */
    async getPrice(chain) {
        const cacheKey = `blockchair_${chain}_price`;

        // 检查缓存
        const cached = Cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const response = await this.callAPI(chain, 'stats');
            const price = response.data?.market_price_usd || 0;

            // 缓存价格（5 分钟）
            Cache.set(cacheKey, price, 5 * 60 * 1000);

            return price;
        } catch (error) {
            console.error(`获取 ${chain} 价格失败:`, error);
            // 返回默认价格
            const defaultPrices = { btc: 42000, eth: 2200, sol: 95 };
            return defaultPrices[chain] || 0;
        }
    }
};

// 导出为全局变量（用于非模块环境）
if (typeof window !== 'undefined') {
    window.Blockchair = Blockchair;
}
