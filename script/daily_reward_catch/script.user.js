// ==UserScript==
// @name         素问打卡奖励截图工具
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在打卡奖励界面添加按钮以长截图奖励内容
// @author       You
// @match        https://sooon.ai/**
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const BUTTON_ID = 'screenshot-gen-btn';
    let isProcessing = false;
    let checkTimer = null;

    console.log('[Screenshot Tool] 脚本 V4 已启动');

    function loadHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (window.html2canvas) return resolve();
            const script = document.createElement('script');
            script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function takeScreenshot() {
        if (isProcessing) return;
        isProcessing = true;
        const btn = document.getElementById(BUTTON_ID);
        const originalText = btn?.innerText;
        if(btn) btn.innerText = '生成中...';

        try {
            await loadHtml2Canvas();
            const textbox = document.querySelector('[role="textbox"]');
            // 往上找三层：Parent -> Grandparent -> Great-Grandparent
            const targetDom = textbox?.parentElement?.parentElement?.parentElement;

            if (!targetDom) {
                alert('未找到截图目标区域，请确认输入框是否已加载');
                return;
            }

            console.log('[Screenshot Tool] 捕获目标节点:', targetDom);

            const canvas = await html2canvas(targetDom, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false
            });

            const link = document.createElement('a');
            link.download = `打卡分享_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('[Screenshot Tool] 截图异常:', err);
        } finally {
            if (btn) btn.innerText = originalText;
            isProcessing = false;
        }
    }

    function injectButton() {
        if (document.getElementById(BUTTON_ID)) return;
        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.innerText = '生成分享长图';
        btn.style.cssText = `
            position: fixed; bottom: 30px; right: 30px; z-index: 99999;
            padding: 12px 24px; background: #10b981; color: white;
            border: none; border-radius: 50px; cursor: pointer;
            font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        btn.onclick = takeScreenshot;
        document.body.appendChild(btn);
        console.log('[Screenshot Tool] 按钮已注入');
    }

    function removeButton() {
        const btn = document.getElementById(BUTTON_ID);
        if (btn) {
            btn.remove();
            console.log('[Screenshot Tool] 按钮已移除');
        }
    }

    // 核心改进：全局扫描逻辑
    function syncUIState() {
        // 1. 检查弹窗外壳是否存在
        const hasDialog = !!document.querySelector('section[role="dialog"]');

        // 2. 全局查找所有目标类名，不再限制在 dialog 内部
        const targetElements = document.querySelectorAll('.text-lg.leading-normal');
        let hasTargetText = false;

        for (const el of targetElements) {
            // 使用 trim() 去除可能存在的空格或换行符
            const content = el.innerText.trim();
            if (content.includes('打卡奖励')) {
                hasTargetText = true;
                break;
            }
        }

        // DEBUG 日志输出，方便观察
        if (hasDialog) {
            console.log(`[Screenshot Tool] 状态确认 -> 弹窗:YES, 目标文字:${hasTargetText ? '找到' : '未找到'}`);
        }

        // 3. 只有两个条件同时满足才显示按钮
        if (hasDialog && hasTargetText) {
            injectButton();
        } else {
            removeButton();
        }
    }

    // 观察器设置
    const observer = new MutationObserver(() => {
        clearTimeout(checkTimer);
        // 缩短延迟，提高响应速度
        checkTimer = setTimeout(syncUIState, 200);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 初始化检查
    syncUIState();

})();