// ==UserScript==
// @name         素问快捷编辑
// @namespace    https://greasyfork.org/users/your-username
// @version      1.3.0
// @description  在 Sooon.ai 文章弹窗中注入一个快捷编辑按钮，一键打开“我的编辑”界面，并在完成后自动关闭所有相关弹窗。
// @author       wzj042
// @match        https://sooon.ai/*
// @grant        GM_log
// @icon         https://sooon.ai/assets/favicon-BRntVMog.ico
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const DEBUG = true;
    const SCRIPT_NAME = 'Sooon.ai Quick Edit';

    function dbg(...msg) {
        if (!DEBUG) return;
        const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        console.log(`[${SCRIPT_NAME} ${t}]`, ...msg);
    }

    dbg('Script loading... (v1.3.0 - Layout & Close logic fix)');

    // 状态管理变量
    let intermediateModal = null; // 存储“相关编辑”的中间模态框
    let cleanupObserver = null;   // 存储关闭监听器，防止重复创建

    /**
     * 关闭中间的“相关编辑”模态框，并清理状态
     */
    function closeIntermediateModalAndCleanup() {
        if (intermediateModal) {
            dbg('Closing intermediate modal...');
            const backButton = intermediateModal.querySelector('header button svg.tabler-icon-chevron-left');
            if (backButton) {
                backButton.closest('button').click();
                dbg('Intermediate modal closed.');
            } else {
                dbg('Could not find back button to close intermediate modal.');
            }
        }
        if (cleanupObserver) {
            cleanupObserver.disconnect();
            cleanupObserver = null;
            dbg('Cleanup observer disconnected.');
        }
        intermediateModal = null;
    }


    /**
     * 监听最终编辑弹窗（底部抽屉）的关闭事件
     */
    function monitorForEditModalClose() {
        if (!intermediateModal) {
            dbg('Error: Intermediate modal not set for monitoring.');
            return;
        }
        // 如果已存在监听器，则先断开
        if (cleanupObserver) {
            cleanupObserver.disconnect();
        }

        dbg('Starting to monitor for final edit modal closure...');
        cleanupObserver = new MutationObserver((mutations) => {
            let finalEditFormRemoved = false;
            for (const mutation of mutations) {
                for (const node of mutation.removedNodes) {
                    // **[FIXED]** 监听包含 <form> 的最终编辑弹窗的移除，这更精确
                    // 无论是点击“完成”还是点击外部遮罩，这个form都会被移除
                    if (node.nodeType === Node.ELEMENT_NODE && node.querySelector('form')) {
                        finalEditFormRemoved = true;
                        break;
                    }
                }
                if (finalEditFormRemoved) break;
            }

            if (finalEditFormRemoved) {
                dbg('Final edit modal (form container) was removed.');
                closeIntermediateModalAndCleanup();
            }
        });
        cleanupObserver.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * 处理快捷编辑按钮的点击事件
     */
    async function handleQuickEditClick(originalRelatedEditButton) {
        if (!originalRelatedEditButton) {
            dbg('Original "Related Edit" button not found.');
            return;
        }
        dbg('Quick Edit button clicked. Starting sequence...');

        originalRelatedEditButton.click();
        dbg('Clicked original "相关编辑" button.');

        let myEditButton = null;
        for (let i = 0; i < 50; i++) { // 等待最多5秒
            const buttons = Array.from(document.querySelectorAll('section[role="dialog"] button'));
            myEditButton = buttons.find(btn => btn.textContent.trim() === '我的编辑');
            if (myEditButton) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!myEditButton) {
            dbg("Timeout: '我的编辑' button not found.");
            return;
        }

        dbg('Found "我的编辑" button:', myEditButton);
        intermediateModal = myEditButton.closest('section[role="dialog"]');

        myEditButton.click();
        dbg('Clicked "我的编辑" button.');

        if (intermediateModal) {
            monitorForEditModalClose();
        }
    }

    /**
     * 向工具栏注入快捷编辑按钮
     */
    function injectQuickEditButton(toolbar) {
        const QUICK_EDIT_BTN_ID = 'sooon-quick-edit-btn';
        // 通过ID检查按钮是否已存在于其父容器中
        const originalRelatedEditButtonContainer = toolbar.querySelector('svg.tabler-icon-bookmarks')?.closest('div.relative');
        if (!originalRelatedEditButtonContainer || originalRelatedEditButtonContainer.parentElement.querySelector(`#${QUICK_EDIT_BTN_ID}`)) {
            return;
        }
        dbg('Toolbar found, attempting to inject button...', toolbar);

        // **[FIXED]** 克隆整个父容器 div 以保持正确的DOM结构和布局
        const quickEditContainer = originalRelatedEditButtonContainer.cloneNode(true);
        const quickEditButton = quickEditContainer.querySelector('button');
        const originalRelatedEditButton = originalRelatedEditButtonContainer.querySelector('button');

        quickEditButton.id = QUICK_EDIT_BTN_ID;
        quickEditButton.ariaLabel = '快捷编辑';
        quickEditButton.setAttribute('title', '快捷编辑');

        // 移除可能克隆过来的角标
        const badge = quickEditContainer.querySelector('.pointer-events-none');
        if (badge) badge.remove();

        const svgIcon = quickEditButton.querySelector('svg');
        if (svgIcon) {
            svgIcon.classList.remove('tabler-icon-bookmarks');
            svgIcon.classList.add('tabler-icon-pencil');
            svgIcon.innerHTML = `<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"></path><path d="M13.5 6.5l4 4"></path>`;
        }

        quickEditButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleQuickEditClick(originalRelatedEditButton);
        });

        // 将新的容器插入到原始容器的前面
        originalRelatedEditButtonContainer.parentNode.insertBefore(quickEditContainer, originalRelatedEditButtonContainer);
        dbg('Successfully injected quick edit button container for proper layout.');
    }

    /**
     * 扫描DOM寻找目标工具栏并注入按钮
     */
    function scanAndInject() {
        const relatedEditIcons = document.querySelectorAll('svg.tabler-icon-bookmarks');
        if (relatedEditIcons.length === 0) return;

        for (const icon of relatedEditIcons) {
            const toolbar = icon.closest('.w-full.flex.items-center.justify-between.gap-2');
            if (toolbar) {
                injectQuickEditButton(toolbar);
            }
        }
    }

    /**
     * 初始化脚本
     */
    function initialize() {
        dbg('Initializing main observer...');
        const mainObserver = new MutationObserver(scanAndInject);
        dbg('Performing initial scan...');
        setTimeout(scanAndInject, 500);
        mainObserver.observe(document.body, { childList: true, subtree: true });
        dbg('Main observer is now active.');
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();