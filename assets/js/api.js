/**
 * API 调用封装
 * 处理 CORS、错误处理、重试逻辑
 */

const API = {
    // 基础配置
    config: {
        timeout: 10000, // 10 秒超时
        retryAttempts: 3,
        retryDelay: 1000, // 1 秒
    },

    /**
     * 通用 fetch 封装
     * @param {string} url - 请求 URL
     * @param {object} options - fetch 选项
     * @returns {Promise<object>} 响应数据
     */
    async fetch(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }

            throw error;
        }
    },

    /**
     * 带重试的 fetch
     * @param {string} url - 请求 URL
     * @param {object} options - fetch 选项
     * @param {number} attempts - 重试次数
     * @returns {Promise<object>} 响应数据
     */
    async fetchWithRetry(url, options = {}, attempts = this.config.retryAttempts) {
        try {
            return await this.fetch(url, options);
        } catch (error) {
            if (attempts <= 1) {
                throw error;
            }

            // 等待后重试
            await this.delay(this.config.retryDelay);
            return this.fetchWithRetry(url, options, attempts - 1);
        }
    },

    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * 格式化地址（缩短显示）
     * @param {string} address - 完整地址
     * @param {number} startLength - 开始保留长度
     * @param {number} endLength - 结束保留长度
     * @returns {string} 缩短后的地址
     */
    shortenAddress(address, startLength = 6, endLength = 4) {
        if (!address || address.length <= startLength + endLength) {
            return address;
        }
        return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
    },

    /**
     * 格式化时间（相对时间）
     * @param {Date|string|number} date - 日期
     * @returns {string} 相对时间字符串
     */
    formatTimeAgo(date) {
        const now = Date.now();
        const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
        const diff = now - timestamp;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) {
            return '刚刚';
        } else if (minutes < 60) {
            return `${minutes} 分钟前`;
        } else if (hours < 24) {
            return `${hours} 小时前`;
        } else if (days < 7) {
            return `${days} 天前`;
        } else {
            return new Date(timestamp).toLocaleDateString('zh-CN');
        }
    },

    /**
     * 格式化金额（带千分位）
     * @param {number} amount - 金额
     * @param {number} decimals - 小数位数
     * @returns {string} 格式化后的金额
     */
    formatAmount(amount, decimals = 2) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '0';
        }
        return amount.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    /**
     * 格式化 USD 金额
     * @param {number} amount - 金额
     * @returns {string} 格式化后的 USD 金额
     */
    formatUSD(amount) {
        if (amount >= 1000000) {
            return `$${this.formatAmount(amount / 1000000, 2)}M`;
        } else if (amount >= 1000) {
            return `$${this.formatAmount(amount / 1000, 2)}K`;
        }
        return `$${this.formatAmount(amount, 2)}`;
    },

    /**
     * 复制到剪贴板
     * @param {string} text - 要复制的文本
     * @returns {Promise<boolean>} 是否成功
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }

            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                return true;
            } catch (err) {
                return false;
            } finally {
                document.body.removeChild(textArea);
            }
        } catch (error) {
            console.error('复制失败:', error);
            return false;
        }
    }
};

// 导出为全局变量（用于非模块环境）
if (typeof window !== 'undefined') {
    window.API = API;
}
