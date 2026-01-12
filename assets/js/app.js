/**
 * 主应用逻辑
 * 处理页面初始化、数据加载、用户交互
 */

const App = {
    // 状态
    state: {
        currentChain: 'all', // all, btc, eth, sol
        currentSort: 'amount', // amount, time
        transactions: [],
        isLoading: false,
        lastUpdate: null,
        expandedTxId: null
    },

    // DOM 元素引用
    elements: {},

    /**
     * 初始化应用
     */
    async init() {
        this.cacheElements();
        this.bindEvents();
        await this.loadData();
        this.startAutoRefresh();
    },

    /**
     * 缓存 DOM 元素
     */
    cacheElements() {
        this.elements = {
            transactionsContainer: document.getElementById('transactions-container'),
            loadingState: document.getElementById('loading-state'),
            errorState: document.getElementById('error-state'),
            emptyState: document.getElementById('empty-state'),
            errorMessage: document.getElementById('error-message'),
            lastUpdate: document.getElementById('last-update'),
            chainBtns: document.querySelectorAll('.chain-btn'),
            sortBtns: document.querySelectorAll('.sort-btn'),
            refreshBtn: document.getElementById('refresh-btn'),
            retryBtn: document.getElementById('retry-btn')
        };
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        // 链切换
        this.elements.chainBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const chain = btn.dataset.chain;
                this.setChain(chain);
            });
        });

        // 排序切换
        document.getElementById('sort-amount')?.addEventListener('click', () => {
            this.setSort('amount');
        });
        document.getElementById('sort-time')?.addEventListener('click', () => {
            this.setSort('time');
        });

        // 刷新按钮
        this.elements.refreshBtn?.addEventListener('click', () => {
            this.loadData(true);
        });

        // 重试按钮
        this.elements.retryBtn?.addEventListener('click', () => {
            this.loadData();
        });
    },

    /**
     * 设置当前链
     * @param {string} chain - 链标识
     */
    setChain(chain) {
        this.state.currentChain = chain;

        // 更新按钮状态
        this.elements.chainBtns.forEach(btn => {
            if (btn.dataset.chain === chain) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 重新渲染
        this.renderTransactions();
    },

    /**
     * 设置排序方式
     * @param {string} sort - 排序方式
     */
    setSort(sort) {
        this.state.currentSort = sort;

        // 更新按钮状态
        document.getElementById('sort-amount')?.classList.toggle('active', sort === 'amount');
        document.getElementById('sort-time')?.classList.toggle('active', sort === 'time');

        // 重新渲染
        this.renderTransactions();
    },

    /**
     * 加载数据
     * @param {boolean} force - 是否强制刷新（忽略缓存）
     */
    async loadData(force = false) {
        if (this.state.isLoading) return;

        this.state.isLoading = true;
        this.showLoading();

        try {
            // 如果强制刷新，清除缓存
            if (force) {
                Cache.clear();
            }

            // 并行获取各链数据
            const [btcTxs, ethTxs, solTxs] = await Promise.allSettled([
                BitcoinService.getLargeTransactions(20),
                EthereumService.getLargeTransactions(20),
                SolanaService.getLargeTransactions(20)
            ]);

            // 合并数据
            this.state.transactions = [];

            if (btcTxs.status === 'fulfilled') {
                this.state.transactions.push(...btcTxs.value);
            }

            if (ethTxs.status === 'fulfilled') {
                this.state.transactions.push(...ethTxs.value);
            }

            if (solTxs.status === 'fulfilled') {
                this.state.transactions.push(...solTxs.value);
            }

            // 更新时间
            this.state.lastUpdate = new Date();
            this.updateLastUpdateTime();

            // 渲染数据
            this.renderTransactions();

        } catch (error) {
            console.error('加载数据失败:', error);

            // 检查是否有任何数据被成功加载
            if (this.state.transactions.length === 0) {
                // 完全没有数据，显示错误
                this.showError(error.message);
            } else {
                // 部分数据加载成功，仍然显示
                this.showTransactions();
                // 显示提示信息
                console.warn('部分数据加载失败，仅显示已加载的数据');
            }
        } finally {
            this.state.isLoading = false;
        }
    },

    /**
     * 渲染交易列表
     */
    renderTransactions() {
        let txs = [...this.state.transactions];

        // 筛选链
        if (this.state.currentChain !== 'all') {
            txs = txs.filter(tx => tx.chain === this.state.currentChain);
        }

        // 排序
        if (this.state.currentSort === 'amount') {
            txs.sort((a, b) => b.amountUsd - a.amountUsd);
        } else {
            txs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        // 空状态检查
        if (txs.length === 0) {
            this.showEmpty();
            return;
        }

        // 渲染
        this.elements.transactionsContainer.innerHTML = txs.map(tx => this.renderTransactionCard(tx)).join('');
        this.showTransactions();

        // 绑定卡片事件
        this.bindCardEvents();
    },

    /**
     * 渲染单个交易卡片
     * @param {object} tx - 交易数据
     * @returns {string} HTML 字符串
     */
    renderTransactionCard(tx) {
        const isExpanded = this.state.expandedTxId === tx.id;
        const chainClass = tx.chain;
        const chainSymbol = {
            btc: '₿',
            eth: 'Ξ',
            sol: '◎'
        }[tx.chain] || '';

        return `
            <div class="tx-card ${isExpanded ? 'expanded' : ''}" data-tx-id="${tx.id}">
                <!-- 卡片头部 -->
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <div class="tx-amount mb-1">${API.formatUSD(tx.amountUsd)}</div>
                        <div class="text-slate-400 text-sm">
                            ${chainSymbol} ${API.formatAmount(tx.amountNative)} ${tx.chain.toUpperCase()}
                        </div>
                    </div>
                    <span class="chain-badge ${chainClass}">${tx.network}</span>
                </div>

                <!-- 交易信息 -->
                <div class="space-y-2 text-sm">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                        </svg>
                        <span class="tx-address">${API.shortenAddress(tx.from)}</span>
                        <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                        </svg>
                        <span class="tx-address">${API.shortenAddress(tx.to)}</span>
                    </div>
                    <div class="flex items-center gap-2 text-slate-500">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span class="time-ago">${API.formatTimeAgo(tx.timestamp)}</span>
                    </div>
                </div>

                <!-- 展开按钮 -->
                ${!isExpanded ? `
                    <div class="mt-3 flex items-center gap-2 text-primary text-sm font-medium">
                        <span>查看详情</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </div>
                ` : `
                    <div class="mt-3">
                        <button class="collapse-btn">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                            </svg>
                            <span>收起详情</span>
                        </button>
                    </div>
                `}

                <!-- 交易详情 -->
                <div class="tx-details ${isExpanded ? 'show' : ''}">
                    ${this.renderTransactionDetails(tx)}
                </div>
            </div>
        `;
    },

    /**
     * 渲染交易详情
     * @param {object} tx - 交易数据
     * @returns {string} HTML 字符串
     */
    renderTransactionDetails(tx) {
        // 判断是否为交易所成交数据
        const isExchangeTrade = tx.isExchangeTrade;

        return `
            <div class="space-y-3">
                <!-- 基本信息 -->
                <div class="detail-item">
                    <span class="detail-label">网络</span>
                    <span class="detail-value">${tx.network}</span>
                </div>

                ${isExchangeTrade ? `
                <!-- 交易所成交标识 -->
                <div class="detail-item">
                    <span class="detail-label">数据来源</span>
                    <span class="detail-value text-primary">Binance 交易所成交</span>
                </div>

                <!-- 成交 ID -->
                <div class="detail-item">
                    <span class="detail-label">成交 ID</span>
                    <span class="detail-value font-mono text-sm">${tx.id}</span>
                </div>

                <!-- 成交价格 -->
                <div class="detail-item">
                    <span class="detail-label">成交价格</span>
                    <span class="detail-value">$${API.formatAmount(tx.price, 2)}</span>
                </div>
                ` : `
                <!-- 交易哈希 -->
                <div class="detail-item">
                    <span class="detail-label">交易哈希</span>
                    <div class="flex items-center gap-2">
                        <span class="tx-address">${API.shortenAddress(tx.hash, 8, 8)}</span>
                        <button class="icon-btn copy-btn" data-copy="${tx.hash}" title="复制">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- 区块 -->
                <div class="detail-item">
                    <span class="detail-label">区块</span>
                    <span class="detail-value">#${tx.blockHeight?.toLocaleString()}</span>
                </div>
                `}

                <!-- 时间 -->
                <div class="detail-item">
                    <span class="detail-label">时间</span>
                    <span class="detail-value">${new Date(tx.timestamp).toLocaleString('zh-CN')}</span>
                </div>

                <!-- 发送方 -->
                <div class="detail-item">
                    <span class="detail-label">${isExchangeTrade ? '交易方' : '发送方'}</span>
                    <div class="flex items-center gap-2">
                        <span class="tx-address">${API.shortenAddress(tx.from)}</span>
                        ${!isExchangeTrade ? `
                        <button class="icon-btn copy-btn" data-copy="${tx.from}" title="复制">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                        </button>
                        ` : ''}
                    </div>
                </div>

                <!-- 接收方 -->
                <div class="detail-item">
                    <span class="detail-label">${isExchangeTrade ? '对手方' : '接收方'}</span>
                    <div class="flex items-center gap-2">
                        <span class="tx-address">${API.shortenAddress(tx.to)}</span>
                        ${!isExchangeTrade ? `
                        <button class="icon-btn copy-btn" data-copy="${tx.to}" title="复制">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                        </button>
                        ` : ''}
                    </div>
                </div>

                <!-- 金额 -->
                <div class="detail-item">
                    <span class="detail-label">${isExchangeTrade ? '成交金额' : '交易金额'}</span>
                    <div class="detail-value">
                        <div class="font-heading font-semibold text-primary">
                            ${API.formatAmount(tx.amountNative)} ${tx.chain.toUpperCase()}
                        </div>
                        <div class="text-sm text-slate-400">≈ ${API.formatUSD(tx.amountUsd)}</div>
                    </div>
                </div>

                ${!isExchangeTrade ? `
                <!-- 费用 -->
                <div class="detail-item">
                    <span class="detail-label">交易费用</span>
                    <div class="detail-value">
                        <div>${API.formatAmount(tx.feeNative, 6)} ${tx.chain.toUpperCase()}</div>
                        <div class="text-sm text-slate-400">≈ $${API.formatAmount(tx.feeUsd, 2)}</div>
                    </div>
                </div>
                ` : `
                <!-- 说明 -->
                <div class="detail-item">
                    <span class="detail-label">说明</span>
                    <div class="detail-value text-sm text-slate-400">
                        此为交易所内大额成交数据<br>
                        非链上转账交易
                    </div>
                </div>
                `}

                <!-- 外部链接 -->
                <div class="pt-2">
                    <a href="${tx.explorerUrl}" target="_blank" rel="noopener" class="external-link">
                        <span>${isExchangeTrade ? '在 Binance 查看' : '在区块浏览器中查看'}</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                    </a>
                </div>
            </div>
        `;
    },

    /**
     * 绑定卡片事件
     */
    bindCardEvents() {
        // 卡片点击展开
        document.querySelectorAll('.tx-card:not(.expanded)').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.icon-btn') || e.target.closest('.external-link')) {
                    return; // 忽略按钮点击
                }
                const txId = card.dataset.txId;
                this.toggleExpand(txId);
            });
        });

        // 收起按钮
        document.querySelectorAll('.collapse-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.tx-card');
                const txId = card.dataset.txId;
                this.toggleExpand(txId);
            });
        });

        // 复制按钮
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const text = btn.dataset.copy;
                const success = await API.copyToClipboard(text);

                if (success) {
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.classList.remove('copied');
                    }, 2000);
                }
            });
        });
    },

    /**
     * 切换展开状态
     * @param {string} txId - 交易 ID
     */
    toggleExpand(txId) {
        if (this.state.expandedTxId === txId) {
            this.state.expandedTxId = null;
        } else {
            this.state.expandedTxId = txId;
        }
        this.renderTransactions();
    },

    /**
     * 更新最后更新时间显示
     */
    updateLastUpdateTime() {
        if (!this.state.lastUpdate) {
            this.elements.lastUpdate.textContent = '加载中...';
            return;
        }
        this.elements.lastUpdate.textContent = `上次更新: ${API.formatTimeAgo(this.state.lastUpdate)}`;
    },

    /**
     * 显示加载状态
     */
    showLoading() {
        this.elements.transactionsContainer.classList.add('hidden');
        this.elements.errorState.classList.add('hidden');
        this.elements.emptyState.classList.add('hidden');
        this.elements.loadingState.classList.remove('hidden');
        document.body.classList.add('loading-pulse');
    },

    /**
     * 显示交易列表
     */
    showTransactions() {
        this.elements.loadingState.classList.add('hidden');
        this.elements.errorState.classList.add('hidden');
        this.elements.emptyState.classList.add('hidden');
        this.elements.transactionsContainer.classList.remove('hidden');
        document.body.classList.remove('loading-pulse');
    },

    /**
     * 显示错误状态
     * @param {string} message - 错误消息
     */
    showError(message) {
        this.elements.loadingState.classList.add('hidden');
        this.elements.transactionsContainer.classList.add('hidden');
        this.elements.emptyState.classList.add('hidden');
        this.elements.errorState.classList.remove('hidden');
        this.elements.errorMessage.textContent = message || '无法获取交易数据，请稍后重试';
        document.body.classList.remove('loading-pulse');
    },

    /**
     * 显示空状态
     */
    showEmpty() {
        this.elements.loadingState.classList.add('hidden');
        this.elements.transactionsContainer.classList.add('hidden');
        this.elements.errorState.classList.add('hidden');
        this.elements.emptyState.classList.remove('hidden');
        document.body.classList.remove('loading-pulse');
    },

    /**
     * 开始自动刷新
     */
    startAutoRefresh() {
        // 每 5 分钟自动刷新
        setInterval(() => {
            this.loadData(true);
        }, 5 * 60 * 1000);

        // 每分钟更新时间显示
        setInterval(() => {
            this.updateLastUpdateTime();
        }, 60 * 1000);
    }
};

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
