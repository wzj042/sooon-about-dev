// ==UserScript==
// @name         素问聚焦顺序阅读
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  将瀑布流顺序阅读改为单列
// @author       You
// @match        https://sooon.ai/home/read/feed*
// @match        https://sooon.ai/**
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let isListMode = GM_getValue('isListMode', true);

    const LIST_STYLE = `
        /* 1. 容器重置：强制从瀑布流转为 Flex 垂直列表 */
        div[role="grid"] {
            display: flex !important;
            flex-direction: column !important;
            height: auto !important;
            min-height: 100vh !important;
            width: 100% !important;
            max-width: 900px !important; /* 限制阅读宽度，居中显示 */
            margin: 0 auto !important;
            gap: 20px !important;
            padding-bottom: 200px !important; /* 底部留白，防止滚动到底部时抖动 */
            transform: none !important;
        }

        /* 2. 单元格重置：移除所有绝对定位和固定宽高 */
        div[role="gridcell"] {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            width: 100% !important;
            height: auto !important;
            transform: none !important;
            visibility: visible !important;
            display: block !important;
        }

        /* 3. 核心修复：强行覆盖卡片内部的固定 194px 宽度 */
        div[role="gridcell"] > div,
        div[role="gridcell"] button {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
        }

        /* 隐藏掉那些用来占位的无用 div，防止撑开空白区域 */
        div[role="grid"] > div:not([role="gridcell"]) {
            display: none !important;
        }
    `;

    // 相对时间转排序权重
    function getTimeWeight(el) {
        const timeEl = el.querySelector('span[class*="dimmed"], span[class*="red-text"]');
        if (!timeEl) return 999999;
        const text = timeEl.innerText.trim();

        if (text.includes('今日') || text.includes('小时前') || text.includes('分钟前') || text.includes('今日')) return 10;
        if (text.includes('昨天')) return 20;
        const daysMatch = text.match(/(\d+)[\s]*天前/);
        if (daysMatch) return 100 + parseInt(daysMatch[1]);
        return 1000;
    }

    function applyFix() {
        if (!isListMode) return;

        const grid = document.querySelector('div[role="grid"]');
        if (grid) {
            grid.style.setProperty('height', 'auto', 'important');
        }

        const cells = document.querySelectorAll('div[role="gridcell"]');
        cells.forEach(cell => {
            // 设置 Flex 排序
            if (!cell.dataset.sorted) {
                cell.style.order = getTimeWeight(cell);
                cell.dataset.sorted = "true";
            }
            // 暴力去除内联宽度样式 (针对 194px 问题)
            const innerDiv = cell.querySelector('div[style*="width"]');
            if (innerDiv) {
                innerDiv.style.setProperty('width', '100%', 'important');
            }
        });
    }

    function toggleMode() {
        isListMode = !isListMode;
        GM_setValue('isListMode', isListMode);
        if (!isListMode) {
            window.location.reload();
        } else {
            initLayout();
        }
    }

    function initLayout() {
        let styleTag = document.getElementById('tm-sooon-fix-layout');
        if (isListMode) {
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = 'tm-sooon-fix-layout';
                styleTag.innerHTML = LIST_STYLE;
                document.head.appendChild(styleTag);
            }
            applyFix();
        }
        updateMenu();
    }

    function updateMenu() {
        GM_registerMenuCommand(isListMode ? "🔄 还原瀑布流" : "📜 切换为时间排序列表", toggleMode);
    }

    // 持续监控，解决虚拟列表滚动时节点更新的问题
    const observer = new MutationObserver(applyFix);
    observer.observe(document.body, { childList: true, subtree: true });

    // 启动
    initLayout();
    // 针对初次加载的补充处理
    setTimeout(applyFix, 1000);

})();