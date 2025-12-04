// ==UserScript==
// @name         素问自动设置文章标题 
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  不再依赖特定的弹窗容器，全局搜索符合 #标题# 格式的按钮，彻底解决多层弹窗导致的查找失败问题。
// @author       wzj042 & Gemini
// @match        https://sooon.ai/**
// @grant        GM_registerMenuCommand
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- 全局配置 ---
    let DEBUG_MODE = true;
    const DEFAULT_TITLE = "素问";

    // 宽松的选择器：只要是无样式按钮即可，不限制 text-base，防止字体大小变化导致失效
    // 关键在于后续的内容正则匹配
    const BUTTON_SELECTOR = 'button.mantine-UnstyledButton-root';

    let checkIntervalId = null;

    function logDebug(...args) { if (DEBUG_MODE) console.log('[Title Manager]', ...args); }

    logDebug('Script loading... (v1.7 Global Search)');

    // --- 核心功能 ---

    /**
     * 核心逻辑：全局搜索符合条件的标题按钮
     */
    function findTitleButtonGlobally() {
        // 1. 获取页面上所有可能的按钮 (范围大，但安全)
        const buttons = document.querySelectorAll(BUTTON_SELECTOR);

        for (const btn of buttons) {
            // 2. 过滤掉不可见的按钮 (防止抓取到隐藏的旧弹窗内容)
            if (btn.offsetParent === null) {
                continue;
            }

            // 3. 检查内容格式
            // HTML 结构通常是: <span>#</span><span>标题</span><span>#</span>
            // textContent 会合并为: "#标题#"
            const rawText = btn.textContent.trim();

            // 正则：以 # 开头，以 # 结尾，中间有内容
            const match = rawText.match(/^#\s*(.+?)\s*#$/);

            if (match && match[1]) {
                const titleText = match[1].trim();
                // 排除空标题
                if (titleText && titleText !== "#") {
                    // logDebug(`找到匹配按钮: [${rawText}] -> 提取标题: [${titleText}]`, btn);
                    return titleText;
                }
            }
        }
        return null;
    }

    /**
     * 轮询检测
     */
    function startTitleDetection() {
        if (checkIntervalId) clearInterval(checkIntervalId);

        let attempts = 0;
        const maxAttempts = 60; // 6秒超时

        logDebug('>>> 触发检测：开始全局搜索标题...');

        // 立即尝试
        let title = findTitleButtonGlobally();
        if (title) {
            document.title = title;
            logDebug(`[秒开] 标题更新为: "${title}"`);
            return;
        }

        // 启动轮询
        checkIntervalId = setInterval(() => {
            attempts++;
            title = findTitleButtonGlobally();

            if (title) {
                document.title = title;
                logDebug(`[轮询成功] 第 ${attempts} 次检测找到标题，更新为: "${title}"`);
                clearInterval(checkIntervalId);
                checkIntervalId = null;
            } else if (attempts >= maxAttempts) {
                logDebug('[超时] 6秒内未找到符合 #标题# 格式的可见按钮。');
                clearInterval(checkIntervalId);
                checkIntervalId = null;
            }
            // 如果页面上连一个 dialog 都没有了，说明用户关得太快，停止检测
            else if (!document.querySelector('section[role="dialog"]')) {
                clearInterval(checkIntervalId);
                checkIntervalId = null;
            }
        }, 100);
    }

    function restoreDefaultTitle() {
        if (checkIntervalId) {
            clearInterval(checkIntervalId);
            checkIntervalId = null;
        }
        // 只有当前标题不是“素问”时才恢复，避免重复操作
        if (document.title !== DEFAULT_TITLE) {
            document.title = DEFAULT_TITLE;
            logDebug(`弹窗关闭，恢复默认标题: "${DEFAULT_TITLE}"`);
        }
    }

    // --- 监听器 ---

    const observer = new MutationObserver((mutationsList) => {
        let shouldStart = false;
        let shouldStop = false;

        for (const mutation of mutationsList) {
            // 只要有节点变化，我们就检查页面上有没有 Dialog
            // 这种方式比检查 addedNodes 更粗暴但更可靠，因为 React 有时会复用节点
            const hasDialog = document.querySelector('section[role="dialog"]');

            if (hasDialog && !checkIntervalId) {
                // 如果有弹窗，且当前没有在检测/未设置标题，则触发
                // 注意：这里逻辑简化了，只要发现弹窗存在，就尝试去“更新”标题
                // 实际由 startTitleDetection 内部逻辑决定是否找到
                if (document.title === DEFAULT_TITLE) {
                    shouldStart = true;
                }
            } else if (!hasDialog) {
                shouldStop = true;
            }
        }

        if (shouldStart) startTitleDetection();
        if (shouldStop) restoreDefaultTitle();
    });

    // --- 启动逻辑 ---

    // 1. 立即检查当前状态
    if (document.querySelector('section[role="dialog"]')) {
        logDebug('脚本启动时已有弹窗，立即开始...');
        startTitleDetection();
    }

    // 2. 启动监听
    observer.observe(document.body, { childList: true, subtree: true });

    // 调试菜单
    GM_registerMenuCommand('切换调试日志', () => {
        DEBUG_MODE = !DEBUG_MODE;
        console.log(`[Title Manager] Debug logs: ${DEBUG_MODE}`);
    });

})();