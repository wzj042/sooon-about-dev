// ==UserScript==
// @name         Sooon.ai 多功能链接复制器 
// @namespace    http://tampermonkey.net/
// @version      5.5
// @description  修复弹窗加载延迟导致加载慢的问题
// @author       Gemini (Based on user feedback & repair)
// @match        https://sooon.ai/**
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        unsafeWindow
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';
    console.log('[Sooon Copier] Script loading... (v5.4 Fast Load Fix)');

    // --- 配置和状态管理 ---
    const COPY_MODE_KEY = 'SOOON_COPY_MODE';
    const MODE_MARKDOWN = 'markdown';
    const MODE_SIMPLE = 'simple';
    const BTN1_ID = 'custom-sooon-copy-btn';
    const BTN2_ID = 'custom-source-copy-btn';
    let menuCommandId;

    function getCopyMode() { return localStorage.getItem(COPY_MODE_KEY) || MODE_MARKDOWN; }
    function setCopyMode(mode) { localStorage.setItem(COPY_MODE_KEY, mode); }

    // --- 核心功能函数 ---
    function parseSharedContent(clipboardText) {
        try {
            const lines = clipboardText.trim().split('\n').filter(line => line.trim() !== '');
            if (lines.length < 2 || !lines[0].includes('#')) { console.error('[Sooon Copier] 解析失败：剪贴板内容格式不符。', clipboardText); return null; }
            let title = '无标题';
            let question = '';
            const firstLine = lines[0];
            let titleMatch = firstLine.match(/#(?:[^#]+)#\s*(.*)/);
            if (!titleMatch) {
                titleMatch = firstLine.match(/#(.*?)#/);
                title = titleMatch ? titleMatch[1].trim() : firstLine.trim();
                question = title;
            } else {
                 const parts = titleMatch[0].split("#");
                 title = parts[1] ? parts[1].trim() : firstLine.trim();
                 question = parts[2] ? parts[2].trim() : title;
            }
            const sooonLine = lines.find(line => line.includes('sooon.ai'));
            const sooonUrl = sooonLine ? sooonLine.match(/https?:\/\/[^\s]+/)[0] : window.location.href;
            const otherLine = lines.find(line => line.includes('http') && !line.includes('sooon.ai'));
            if (!otherLine) { return { title, question, sooonUrl, otherUrl: null, otherSource: null }; }
            const otherUrl = otherLine.match(/https?:\/\/[^\s]+/)[0];
            const otherSource = otherLine.split(':')[0].trim();
            return { title, question, sooonUrl, otherUrl, otherSource };
        } catch (error) { console.error("[Sooon Copier] 解析分享文本时出错:", error, "Raw text:", clipboardText); return null; }
    }

    function findTargetShareButton(container, selector) {
        const toolbar = container.querySelector(selector);
        if (!toolbar) { return null; }
        const icon = toolbar.querySelector('svg.tabler-icon-link, svg.tabler-icon-copy, svg.tabler-icon-share');
        return icon ? icon.closest('button') : null;
    }

    async function handleCopyClick(e, buttonElement, targetType) {
        e.preventDefault(); e.stopPropagation();
        const modal = buttonElement.closest('section[role="dialog"]');
        if (!modal) { console.error("[Sooon Copier] 错误：无法向上找到文章弹窗容器！"); return; }
        const triggerButton = findTargetShareButton(modal, '.flex.items-center.px-4.pb-2');
        if (!triggerButton) { console.error("[Sooon Copier] 错误：点击时无法定位到底部工具栏的原始复制按钮！"); return; }

        // 使用 unsafeWindow 确保事件正确触发
        triggerButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: unsafeWindow }));

        try {
            const buttonTextToFind = targetType === 'sooon' ? '素问' : '来源';
            let targetButtonClickable = null;
            for (let i = 0; i < 20; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                const dialogs = document.querySelectorAll('div[role="dialog"]');
                if (dialogs.length > 0) {
                    const hoverDialog = dialogs[dialogs.length-1];
                    const buttons = hoverDialog.querySelectorAll('button');
                    for (const btn of buttons) { if (btn.textContent.trim().includes(buttonTextToFind)) { targetButtonClickable = btn; break; } }
                }
                if (targetButtonClickable) break;
            }
            if (!targetButtonClickable) {
                 console.error(`[Sooon Copier] 超时：无法在悬停弹窗中找到按钮 "${buttonTextToFind}"`);
                 return;
            }

            targetButtonClickable.click();
            await new Promise(resolve => setTimeout(resolve, 200));
            const rawText = await navigator.clipboard.readText();
            const data = parseSharedContent(rawText);
            if (!data || !data.title) { console.error("[Sooon Copier] 无法从剪贴板内容中解析出有效数据。"); return; }
            const mode = getCopyMode();
            let textToCopy = '';
            if (targetType === 'sooon') {
                textToCopy = mode === MODE_MARKDOWN ? `[《${data.title}》](${data.sooonUrl} "${data.question}")` : data.sooonUrl;
            } else {
                if (!data.otherUrl) { console.warn("[Sooon Copier] 未找到其他来源的链接。"); return; }
                textToCopy = mode === MODE_MARKDOWN ? `[${data.title}](${data.otherUrl} "${data.question}")` : data.otherUrl;
            }
            await navigator.clipboard.writeText(textToCopy);
            console.log(`[Sooon Copier] 已复制:`, textToCopy);
            const originalContent = buttonElement.querySelector('span').innerHTML;
            buttonElement.querySelector('span').innerHTML = '✔';
            setTimeout(() => { if (buttonElement && buttonElement.querySelector('span')) { buttonElement.querySelector('span').innerHTML = originalContent; } }, 2000);
        } catch (err) { console.error("[Sooon Copier] 复制操作失败:", err);
        } finally {
            triggerButton.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true, view: unsafeWindow }));
        }
    }

    // --- UI 注入 ---

    // 返回值：true 表示注入成功或已存在，false 表示还没找到插入点
    function injectButton(modal) {
        if (modal.querySelector(`#${BTN1_ID}`)) { return true; } // 已经存在，视为成功
        const shareButton = findTargetShareButton(modal, '.flex.items-center.px-4.pb-2');
        if (!shareButton) { return false; } // 还没加载出来

        console.log('[Sooon Copier] 发现工具栏，正在注入按钮...');
        const buttonContainer = shareButton.parentElement;
        if (!buttonContainer) { return false; }

        const createButton = (id, text, clickHandler) => {
            const btn = shareButton.cloneNode(true);
            btn.id = id;
            btn.setAttribute('aria-label', `自定义复制-${text}`);
            const iconSpan = btn.querySelector('span');
            if (iconSpan) {
                iconSpan.innerHTML = text;
                iconSpan.style.fontSize = '0.9rem';
                iconSpan.style.fontWeight = 'bold';
            } else {
                btn.innerHTML = `<span style="font-size: 0.9rem; font-weight: bold;">${text}</span>`;
            }
            btn.addEventListener('click', (e) => clickHandler(e, btn));
            return btn;
        };
        const sooonButton = createButton(BTN1_ID, '素', (e, btn) => handleCopyClick(e, btn, 'sooon'));
        const sourceButton = createButton(BTN2_ID, '源', (e, btn) => handleCopyClick(e, btn, 'other'));

        buttonContainer.insertBefore(sooonButton, shareButton);
        buttonContainer.insertBefore(sourceButton, shareButton);
        console.log('%c[Sooon Copier] 自定义复制按钮注入成功！', 'color: green; font-weight: bold;');
        return true;
    }

    function updateMenu() {
        if (menuCommandId) { GM_unregisterMenuCommand(menuCommandId); }
        const currentMode = getCopyMode();
        const menuText = `切换复制模式 (当前: ${currentMode === MODE_MARKDOWN ? 'Markdown' : '纯链接'})`;
        menuCommandId = GM_registerMenuCommand(menuText, () => {
            const newMode = currentMode === MODE_MARKDOWN ? MODE_SIMPLE : MODE_MARKDOWN;
            setCopyMode(newMode);
            console.log(`[Sooon Copier] 已切换到 ${newMode === MODE_MARKDOWN ? "Markdown" : "纯链接"} 模式`);
            updateMenu();
        });
    }

    // --- 脚本启动入口 ---

    // 新增：轮询注入机制，替代旧的 setTimeout
    function tryInjectUntilSuccess(modal) {
        let attempts = 0;
        const maxAttempts = 50; // 50 * 100ms = 5秒超时

        // 立即尝试一次
        if (injectButton(modal)) return;

        const intervalId = setInterval(() => {
            attempts++;
            const success = injectButton(modal);

            // 如果成功，或者模态框被关闭了(不在文档中)，停止检测
            if (success || !document.body.contains(modal)) {
                clearInterval(intervalId);
            } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                console.log('[Sooon Copier] 注入超时：工具栏未在 5 秒内出现');
            }
        }, 100); // 每 100ms 检查一次
    }

    updateMenu();
    console.log('[Sooon Copier] 初始化 MutationObserver...');
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const modal = node.matches && node.matches('section[role="dialog"]') ? node : node.querySelector('section[role="dialog"]');
                        if (modal) {
                            // 【核心修复】不再死等900ms，而是启动轮询检测
                            tryInjectUntilSuccess(modal);
                        }
                    }
                });
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[Sooon Copier] 脚本已启动并正在监视页面变化。');
})();