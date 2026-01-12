/**
 * Solana 区块链数据获取
 * 使用 Binance API 获取 SOLUSDT 大额成交
 */

const SolanaService = {
    // 最小交易金额（USD）
    minUSD: 100000,

    /**
     * 获取大额交易
     * @param {number} limit - 返回数量
     * @returns {Promise<Array>} 大额交易列表
     */
    async getLargeTransactions(limit = 20) {
        return await Binance.getLargeTransactions('sol', limit);
    },

    /**
     * 获取 SOL 价格
     * @returns {Promise<number>} SOL 价格（USD）
     */
    async getPrice() {
        return await Binance.getPrice('sol');
    }
};

// 导出为全局变量（用于非模块环境）
if (typeof window !== 'undefined') {
    window.SolanaService = SolanaService;
}
