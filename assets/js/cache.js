/**
 * 简单的内存缓存管理
 * 用于缓存 API 响应，减少请求频率
 */

const Cache = {
    // 缓存存储
    _storage: {},

    // 缓存时长（毫秒）- 默认 5 分钟
    _defaultTTL: 5 * 60 * 1000,

    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {any} value - 缓存值
     * @param {number} ttl - 过期时间（毫秒）
     */
    set(key, value, ttl = this._defaultTTL) {
        this._storage[key] = {
            value: value,
            expiry: Date.now() + ttl
        };
    },

    /**
     * 获取缓存
     * @param {string} key - 缓存键
     * @returns {any|null} 缓存值或 null
     */
    get(key) {
        const item = this._storage[key];

        if (!item) {
            return null;
        }

        // 检查是否过期
        if (Date.now() > item.expiry) {
            delete this._storage[key];
            return null;
        }

        return item.value;
    },

    /**
     * 删除缓存
     * @param {string} key - 缓存键
     */
    delete(key) {
        delete this._storage[key];
    },

    /**
     * 清空所有缓存
     */
    clear() {
        this._storage = {};
    },

    /**
     * 检查缓存是否存在且未过期
     * @param {string} key - 缓存键
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== null;
    },

    /**
     * 获取缓存统计信息
     * @returns {object} 缓存统计
     */
    getStats() {
        const keys = Object.keys(this._storage);
        const now = Date.now();
        let validCount = 0;
        let expiredCount = 0;

        keys.forEach(key => {
            if (now > this._storage[key].expiry) {
                expiredCount++;
            } else {
                validCount++;
            }
        });

        return {
            total: keys.length,
            valid: validCount,
            expired: expiredCount
        };
    }
};

// 导出为全局变量（用于非模块环境）
if (typeof window !== 'undefined') {
    window.Cache = Cache;
}
