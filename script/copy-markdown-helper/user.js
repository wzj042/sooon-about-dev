// ==UserScript==
// @name         Sooon.ai 多功能链接复制器 
// @namespace    http://tampermonkey.net/
// @version      5.4
// @description  修复悬浮按钮检索来源问题
// @author       Gemini (Based on user feedback & repair)
// @match        https://sooon.ai/**
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        unsafeWindow
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';
    console.log('[Sooon Copier] Script loading... (v5.3 unsafeWindow Fix)');

    // --- 配置和状态管理 (无变化) ---
    const COPY_MODE_KEY = 'SOOON_COPY_MODE';
    const MODE_MARKDOWN = 'markdown';
    const MODE_SIMPLE = 'simple';
    const BTN1_ID = 'custom-sooon-copy-btn';
    const BTN2_ID = 'custom-source-copy-btn';
    let menuCommandId;

    function getCopyMode() { return localStorage.getItem(COPY_MODE_KEY) || MODE_MARKDOWN; }
    function setCopyMode(mode) { localStorage.setItem(COPY_MODE_KEY, mode); }

    // --- 核心功能函数 (无变化) ---
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

        console.log('[Sooon Copier] 定位到触发悬停的按钮:', triggerButton);

        // 【核心修复】使用 unsafeWindow 来创建 MouseEvent，以确保事件的 'view' 属性是页面真实的 window 对象
        triggerButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: unsafeWindow }));

        try {
            const buttonTextToFind = targetType === 'sooon' ? '素问' : '知乎';
            console.log(`[Sooon Copier] 正在查找包含文本 "${buttonTextToFind}" 的按钮...`);
            let targetButtonClickable = null;
            for (let i = 0; i < 20; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                const dialogs = document.querySelectorAll('div[role="dialog"]');
                if (dialogs.length > 0) {
                    const hoverDialog = dialogs[dialogs.length-1];
                    const backup = '爱发电';
                    const buttons = hoverDialog.querySelectorAll('button');
                    for (const btn of buttons) { if (btn.textContent.trim().includes(buttonTextToFind) || btn.textContent.trim().includes(backup)) { targetButtonClickable = btn; break; } }
                }
                if (targetButtonClickable) break;
            }
            if (!targetButtonClickable) {
                 console.error(`[Sooon Copier] 超时：无法在悬停弹窗中找到按钮 "${buttonTextToFind}"`);
                 return;
            }

            console.log('[Sooon Copier] 找到并准备点击目标按钮:', targetButtonClickable);
            targetButtonClickable.click();
            await new Promise(resolve => setTimeout(resolve, 200));
            const rawText = await navigator.clipboard.readText();
            console.log('[Sooon Copier] 从剪贴板读取到内容:\n---', rawText, '\n---');
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
            console.log(`[Sooon Copier] 已将格式化后的链接复制到剪贴板:`, textToCopy);
            const originalContent = buttonElement.querySelector('span').innerHTML;
            buttonElement.querySelector('span').innerHTML = '✔';
            setTimeout(() => { if (buttonElement && buttonElement.querySelector('span')) { buttonElement.querySelector('span').innerHTML = originalContent; } }, 2000);
        } catch (err) { console.error("[Sooon Copier] 复制操作失败:", err);
        } finally {
            // 【核心修复】同样，清理操作也需要使用 unsafeWindow
            triggerButton.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true, view: unsafeWindow }));
        }
    }

    // --- UI 注入和菜单设置 (无变化) ---

    function injectButton(modal) {
        if (modal.querySelector(`#${BTN1_ID}`)) { return; }
        const shareButton = findTargetShareButton(modal, '.flex.items-center.px-4.pb-2');
        if (!shareButton) { return; }

        console.log('[Sooon Copier] 成功匹配文章弹窗，准备注入按钮...');
        const buttonContainer = shareButton.parentElement;
        if (!buttonContainer) { console.error('[Sooon Copier] 致命错误：找到了按钮但找不到其父容器。'); return; }

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

    // --- 脚本启动入口 (无变化) ---

    updateMenu();
    console.log('[Sooon Copier] 初始化 MutationObserver...');
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const modal = node.matches && node.matches('section[role="dialog"]') ? node : node.querySelector('section[role="dialog"]');
                        if (modal) {
                            setTimeout(() => injectButton(modal), 900);
                        }
                    }
                });
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[Sooon Copier] 脚本已启动并正在监视页面变化。');
})();