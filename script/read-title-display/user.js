// ==UserScript==
// @name         素问显示文章标题
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动设置网页标题为参考源标题
// @author       You
// @match        https://sooon.ai/**
// @grant        none
// ==/UserScript==

(function() {
    'use strict';


    // 标题更新函数
    function updateTitle() {
        const targetElement = document.querySelector('.items-stretch .text-base');
        if (targetElement) {
            const content = targetElement.textContent.trim();
            const match = content.match(/^#(.+)#$/);

            if (match) {
                const titleText = match[1].trim();
                document.title = titleText;
                return true; // 表示标题已成功更新
            }
        }
        return false;
    }

    // 首次立即尝试更新
    updateTitle();

    // 创建观察器动态监听DOM变化
    const observer = new MutationObserver(() => {
        updateTitle();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
    });

    // 辅助轮询机制（防止动态内容加载延迟）
    let pollCount = 0;
    const maxPollCount = 30; // 最大重试次数（约15秒）

    const titlePoll = setInterval(() => {
        if (updateTitle() || pollCount++ > maxPollCount) {
            clearInterval(titlePoll);
        }
    }, 500);

    // 确保脚本停止后清理资源
    window.addEventListener('unload', () => {
        observer.disconnect();
        clearInterval(titlePoll);
    });
})();