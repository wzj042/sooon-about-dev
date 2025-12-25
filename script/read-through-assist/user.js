// ==UserScript==
// @name         素问通读助手
// @namespace    npm/vite-plugin-monkey
// @version      1.1.0
// @author       wzj042
// @description  素问通读助手
// @license      MIT
// @icon         https://sooon.ai/assets/favicon-BRntVMog.ico
// @match        https://sooon.ai/**
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  "use strict";


  const APP_NAME = "素问通读助手";
  // DEBUG 标志，用于调试页面延迟问题
  const DEBUG = false;

  function getTimeStr() {
    const d = /* @__PURE__ */ new Date();
    return d.toTimeString().slice(0, 8);
  }
  function formatLog(msg) {
    return [`[${APP_NAME}] [${getTimeStr()}]`, msg];
  }
  const log = (...a) => {
    const msg = a.map(String).join(" ");
    console.log(...formatLog(msg));
  };
  const warn = (...a) => {
    const msg = a.map(String).join(" ");
    console.warn(...formatLog(msg));
  };
  const debugLog = (...a) => {
    if (!DEBUG) return;
    const msg = a.map(String).join(" ");
    console.log(`[DEBUG] [${getTimeStr()}]`, msg);
  };
  async function waitForElement(selector, options = {}) {
    const {
      timeout = 5e3,
      interval = 100,
      maxRetries = 50,
      noError = false,
    } = options;
    return new Promise((resolve, reject) => {
      let retries = 0;
      const startTime = Date.now();
      const find = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime >= timeout) {
          if (noError) {
            resolve(null);
          } else {
            reject(
              new Error(
                `Element ${selector} not found after ${timeout}ms timeout`
              )
            );
          }
          return;
        }
        if (retries >= maxRetries) {
          if (noError) {
            resolve(null);
          } else {
            reject(
              new Error(
                `Element ${selector} not found after ${maxRetries} retries`
              )
            );
          }
          return;
        }
        retries++;
        setTimeout(find, interval);
      };
      find();
    });
  }

  // 等待虚拟列表内容加载完成
  async function waitForVirtualListContent(options = {}) {
    const {
      timeout = 10000, // 增加超时时间到10秒
      checkInterval = 200,
      minItems = 1,
      maxEmptyChecks = 15, // 减少最大连续空检查次数，避免无限循环
    } = options;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let emptyChecks = 0;
      let lastItemCount = 0;
      let hasSeenContent = false; // 标记是否曾经看到过内容

      const check = () => {
        const elapsedTime = Date.now() - startTime;

        // 获取虚拟列表容器
        const listContainer = document.querySelector(SELECTORS.ARTICLE.LIST);
        if (!listContainer) {
          debugLog("虚拟列表容器未找到");
          if (elapsedTime >= timeout) {
            reject(new Error("虚拟列表容器未找到"));
            return;
          }
          setTimeout(check, checkInterval);
          return;
        }

        // 检查是否有实际的列表项（不仅仅是占位符）
        const items = listContainer.querySelectorAll(SELECTORS.ARTICLE.ITEM);
        const visibleItems = Array.from(items).filter(item => {
          // 检查项目是否有实际内容，不仅仅是占位符
          const hasContent = item.querySelector(".font-semibold") ||
                            item.querySelector("._text_1alq7_1") ||
                            item.querySelector("svg.tabler-icon-eye");
          return hasContent && item.style.display !== "none";
        });

        const currentItemCount = visibleItems.length;

        // 如果曾经看到过内容，但现在是空的，可能是页面切换中的正常现象
        if (currentItemCount > 0) {
          hasSeenContent = true;
        }

        // 如果找到足够的项目
        if (currentItemCount >= minItems) {
          debugLog(`虚拟列表内容加载完成，找到 ${currentItemCount} 个项目`);
          resolve({
            container: listContainer,
            items: items,
            visibleItems: visibleItems,
            count: currentItemCount
          });
          return;
        }

        // 如果从未看到过内容且连续检查为空，或者已经看过内容但现在为空且超过一定次数
        if (currentItemCount === lastItemCount) {
          emptyChecks++;
          debugLog(`虚拟列表仍为空，连续检查次数: ${emptyChecks}/${maxEmptyChecks} (曾经看到内容: ${hasSeenContent})`);
        } else {
          emptyChecks = 0;
          lastItemCount = currentItemCount;
        }

        // 超时检查
        if (elapsedTime >= timeout) {
          debugLog(`虚拟列表等待超时，已等待 ${elapsedTime}ms`);
          resolve({
            container: listContainer,
            items: items,
            visibleItems: visibleItems,
            count: currentItemCount,
            timeout: true
          });
          return;
        }

        // 如果连续多次检查为空，快速失败以避免无限循环
        if (emptyChecks >= maxEmptyChecks) {
          debugLog(`虚拟列表连续 ${maxEmptyChecks} 次检查为空，停止等待`);
          resolve({
            container: listContainer,
            items: items,
            visibleItems: visibleItems,
            count: currentItemCount,
            timeout: true
          });
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  // 智能等待页面稳定
  async function waitForPageStable(options = {}) {
    const {
      timeout = 8000,
      checkInterval = 300,
      stableChecks = 3, // 连续3次检查状态相同认为页面稳定
    } = options;

    return new Promise((resolve) => {
      const startTime = Date.now();
      let lastState = null;
      let stableCount = 0;

      const check = () => {
        const elapsedTime = Date.now() - startTime;

        // 获取当前页面状态
        const listContainer = document.querySelector(SELECTORS.ARTICLE.LIST);
        if (!listContainer) {
          if (elapsedTime >= timeout) {
            debugLog("等待页面稳定超时，返回当前状态");
            resolve({ stable: false, timeout: true });
            return;
          }
          setTimeout(check, checkInterval);
          return;
        }

        const items = listContainer.querySelectorAll(SELECTORS.ARTICLE.ITEM);
        const visibleItems = Array.from(items).filter(item => item.style.display !== "none");
        const currentState = {
          totalItems: items.length,
          visibleItems: visibleItems.length,
          containerHeight: listContainer.scrollHeight
        };

        debugLog(`页面稳定检查: 总项=${currentState.totalItems}, 可见项=${currentState.visibleItems}`);

        // 检查状态是否稳定
        if (lastState &&
            lastState.totalItems === currentState.totalItems &&
            lastState.visibleItems === currentState.visibleItems &&
            lastState.containerHeight === currentState.containerHeight) {
          stableCount++;
          debugLog(`页面状态稳定计数: ${stableCount}/${stableChecks}`);
        } else {
          stableCount = 0;
        }

        lastState = currentState;

        if (stableCount >= stableChecks) {
          debugLog("页面已稳定");
          resolve({ stable: true, state: currentState });
          return;
        }

        if (elapsedTime >= timeout) {
          debugLog("等待页面稳定超时");
          resolve({ stable: false, state: currentState, timeout: true });
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }
  const ls = {
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    get(key) {
      const value = localStorage.getItem(key);
      try {
        return value === null ? null : JSON.parse(value);
      } catch (e) {
        return value;
      }
    },
    remove(key) {
      localStorage.removeItem(key);
    },
    clear() {
      localStorage.clear();
    },
    keys() {
      return Object.keys(localStorage);
    },
    has(key) {
      return localStorage.getItem(key) !== null;
    },
  };

      var _GM_registerMenuCommand = /* @__PURE__ */ (() =>
    typeof GM_registerMenuCommand != "undefined"
      ? GM_registerMenuCommand
      : void 0)();
  const FILTER_COUNT_KEY = "sooon_filter_count";
  const STORAGE_KEY = "sooon_page_state";
  const IGNORE_SET_KEY = "sooon_ignore_set";
  const AUTO_PAGE_DIRECTION_KEY = "sooon_auto_page_direction";
  const AUTO_PAGE_INTERVAL_KEY = "sooon_auto_page_interval";
  const AUTO_REFRESH_KEY = "sooon_auto_refresh";
  const AUTO_PAGE_ENABLED_KEY = "sooon_auto_page_enabled";
  const LAST_READ_PAGE_KEY = "sooon_last_read_page";
  let hasRestoredPage = false;
  let isProcessing = false;
  let lastProcessedPath = null;
  let saveStateTimeout = null;
  let autoPageTimer = null;
  let lastListCheckTime = 0;
  let isAutoPaging = false; // 标记是否正在执行自动翻页
  let autoPageCooldown = false; // 自动翻页冷却标志
  let articleObserver = null; // 文章列表的 MutationObserver 实例
  const SELECTORS = {
    PAGINATION: {
      CONTAINER:
        "#root > div > main > div.flex-1.flex.flex-col.overflow-hidden > div > div > div > div.flex.items-center.justify-center.px-2.pt-1.pb-1 > div > div",
      NEXT_PAGE:
        "div.flex.items-center.justify-center.px-2.pt-1.pb-1 > div > div > button:nth-child(3)",
      PREV_PAGE:
        "div.flex.items-center.justify-center.px-2.pt-1.pb-1 > div > div > button:nth-child(1)",
      PAGE_INPUT: 'input[name="page"]',
      SORT_BUTTON:
        "#root > div > main > div.flex-1.flex.flex-col.overflow-hidden > div > div.flex-1.flex.flex-col.overflow-hidden > div > div.flex.items-center.justify-center.px-2.pt-1.pb-1 > div > button:nth-child(1)",
    },
    ARTICLE: {
      CONTAINER:
        "#root > div > div > div > main > div.flex-1.flex.flex-col.overflow-hidden > div > div.flex-1.flex.flex-col.overflow-hidden > div > div.flex-1.flex.flex-col.overflow-hidden > div > div > div > div._children_whrto_2.flex-1 > div",
      LIST: "div[data-autofocus]",
      ITEM: "div.w-full",
      READ_COUNT_ICON: "svg.tabler-icon-eye",
      STATS_CONTAINER:
        " #root > div > main > div.flex.flex-col .w-full.justify-between",
    },
  };
  const getIgnoreSet = () => {
    const stored = ls.get(IGNORE_SET_KEY);
    return stored ? new Set(stored) : /* @__PURE__ */ new Set();
  };
  const saveIgnoreSet = (set) => {
    ls.set(IGNORE_SET_KEY, Array.from(set));
  };
  const addToIgnoreSet = (articleId) => {
    const ignoreSet = getIgnoreSet();
    ignoreSet.add(articleId);
    saveIgnoreSet(ignoreSet);
  };
  const getFilterCount = () => {
    const stored = ls.get(FILTER_COUNT_KEY);
    return stored !== null ? parseInt(stored, 10) : 1;
  };
  const setFilterCount = (count) => {
    if (count >= 0) {
      ls.set(FILTER_COUNT_KEY, count);
      return true;
    }
    return false;
  };
  const getAutoPageDirection = () => {
    const stored = ls.get(AUTO_PAGE_DIRECTION_KEY);
    return stored || "next";
  };
  const setAutoPageDirection = (direction) => {
    if (direction === "next" || direction === "prev") {
      ls.set(AUTO_PAGE_DIRECTION_KEY, direction);
      return true;
    }
    return false;
  };
  const getAutoPageInterval = () => {
    const stored = ls.get(AUTO_PAGE_INTERVAL_KEY);
    return stored !== null ? parseInt(stored, 10) : 5e3;
  };
  const setAutoPageInterval = (interval) => {
    const parsedInterval = parseInt(interval, 10);
    if (
      !isNaN(parsedInterval) &&
      parsedInterval >= 1e3 &&
      parsedInterval <= 6e4
    ) {
      ls.set(AUTO_PAGE_INTERVAL_KEY, parsedInterval);
      return true;
    }
    return false;
  };
  const getAutoRefresh = () => {
    const stored = ls.get(AUTO_REFRESH_KEY);
    return stored !== null ? stored : true; // 默认启用
  };
  const setAutoRefresh = (enabled) => {
    ls.set(AUTO_REFRESH_KEY, Boolean(enabled));
    return true;
  };
  const getAutoPageEnabled = () => {
    const stored = ls.get(AUTO_PAGE_ENABLED_KEY);
    return stored !== null ? stored : true; // 默认启用
  };
  const setAutoPageEnabled = (enabled) => {
    ls.set(AUTO_PAGE_ENABLED_KEY, Boolean(enabled));
    return true;
  };
  const registerMenuCommands = () => {
    _GM_registerMenuCommand("🔍 设置过滤阈值 (FC)", () => {
      const currentCount = getFilterCount();
      const newCount = prompt(
        "请输入新的筛选阈值（0或更大的数字）：\n设置为0表示暂停过滤",
        currentCount
      );
      if (newCount !== null) {
        const parsedCount = parseInt(newCount, 10);
        if (!isNaN(parsedCount) && parsedCount >= 0) {
          if (setFilterCount(parsedCount)) {
            filterArticlesByReadCount();
          }
        } else {
          alert("请输入有效的数字（0或更大）");
        }
      }
    });
    _GM_registerMenuCommand("🔄 设置自动翻页方向", () => {
      const currentDirection = getAutoPageDirection();
      const direction = prompt(
        '请选择自动翻页方向：\n输入 "next" 或 "n" 表示下一页\n输入 "prev" 或 "p" 表示上一页\n当前设置：' +
          (currentDirection === "next" ? "下一页" : "上一页"),
        currentDirection
      );
      if (direction !== null) {
        const normalizedDirection = direction.toLowerCase().startsWith("n")
          ? "next"
          : direction.toLowerCase().startsWith("p")
          ? "prev"
          : direction;
        if (setAutoPageDirection(normalizedDirection)) {
          log(`自动翻页方向已设置为: ${
            normalizedDirection === "next" ? "下一页" : "上一页"
          }`);
          alert(
            `自动翻页方向已设置为: ${
              normalizedDirection === "next" ? "下一页" : "上一页"
            }`
          );
        } else {
          alert("请输入有效的方向：next/n 或 prev/p");
        }
      }
    });
    _GM_registerMenuCommand("⏱️ 设置自动翻页检测间隔", () => {
      const currentInterval = getAutoPageInterval();
      const interval = prompt(
        "请设置自动翻页检测间隔（毫秒）：\n输入1000-60000之间的数字\n1000毫秒 = 1秒\n当前设置：" +
          currentInterval +
          "毫秒（" +
          currentInterval / 1e3 +
          "秒）",
        currentInterval
      );
      if (interval !== null) {
        const parsedInterval = parseInt(interval, 10);
        if (setAutoPageInterval(parsedInterval)) {
          log(`自动翻页检测间隔已设置为: ${parsedInterval/1000}秒`);
          alert(
            `自动翻页检测间隔已设置为: ${parsedInterval}毫秒（${
              parsedInterval / 1e3
            }秒）`
          );
        } else {
          alert("请输入有效的间隔时间：1000-60000之间的数字");
        }
      }
    });
    _GM_registerMenuCommand("🔄 设置自动刷新", () => {
      const currentSetting = getAutoRefresh();
      const message = `自动刷新功能（翻页时强制刷新内容）\n\n当前设置：${currentSetting ? '已启用' : '已禁用'}\n\n点击"确定"${currentSetting ? '禁用' : '启用'}自动刷新`;

      const action = confirm(message);
      if (action) {
        const newSetting = !currentSetting;
        setAutoRefresh(newSetting);
        log(`自动刷新功能已${newSetting ? '启用' : '禁用'}`);
        alert(`自动刷新功能已${newSetting ? '启用' : '禁用'}`);
      }
    });
    _GM_registerMenuCommand("📄 设置自动翻页", () => {
      const currentSetting = getAutoPageEnabled();
      const message = `自动翻页功能（当页面内容全部被过滤时自动跳转到下一页）\n\n当前设置：${currentSetting ? '已启用' : '已禁用'}\n\n点击"确定"${currentSetting ? '禁用' : '启用'}自动翻页`;

      const action = confirm(message);
      if (action) {
        const newSetting = !currentSetting;
        setAutoPageEnabled(newSetting);
        log(`自动翻页功能已${newSetting ? '启用' : '禁用'}`);
        alert(`自动翻页功能已${newSetting ? '启用' : '禁用'}`);
      }
    });
    _GM_registerMenuCommand("📖 上次阅读页数", () => {
      const lastPage = getLastReadPage();
      const currentPage = getPage();
      const message = `上次阅读页数：${lastPage}\n当前页数：${currentPage}\n\n点击"确定"跳转到上次阅读页数，"取消"清除记录`;

      const action = confirm(message);
      if (action) {
        // 跳转到上次阅读页数
        window.location.href = `/home/read/published/${lastPage}`;
      } else {
        // 清除记录
        ls.remove(LAST_READ_PAGE_KEY);
        log("已清除上次阅读页数记录");
        alert("已清除上次阅读页数记录");
      }
    });
  };
  const calculateReadProgress = async () => {
    try {
      // 获取页面参数来计算总文章数
      const pageParam = await getPageParam();
      const totalItems = pageParam.pageSize * pageParam.allPage;

      // 直接使用 ignoreSet 的大小作为已忽略文章数
      const ignoreSet = getIgnoreSet();
      const ignoredCount = ignoreSet.size;

      // log(`总文章数: ${totalItems} (每页${pageParam.pageSize} × ${pageParam.allPage}页)`);
      // log(`ignoreSet中的已忽略文章数: ${ignoredCount}`);

      // 如果 ignoreSet 为空，说明还没有数据，等待一会儿再试
      if (ignoredCount === 0) {
        log("忽略集合为空，延迟重试...");
        setTimeout(() => {
          updateReadProgressDisplay();
        }, 2000);
        return { totalItems: 0, ignoredCount: 0 };
      }

      return { totalItems, ignoredCount };
    } catch (error) {
      warn("计算阅读进度时出错:", error);
      // 降级处理：使用当前页的文章数
      const articleList = document.querySelector(SELECTORS.ARTICLE.LIST);
      if (articleList) {
        const allItems = articleList.querySelectorAll(SELECTORS.ARTICLE.ITEM);
        return { totalItems: allItems.length, ignoredCount: 0 };
      }
      return { totalItems: 0, ignoredCount: 0 };
    }
  };

  const updateReadProgressDisplay = async () => {
    const { totalItems, ignoredCount } = await calculateReadProgress();
    await updateReadProgress(totalItems, ignoredCount);
  };

  const updateReadProgress = async (totalItems, ignoredCount) => {
    const container = await waitForElement(SELECTORS.ARTICLE.STATS_CONTAINER);
    if (!container) {
      debugLog("未找到统计容器，跳过进度更新");
      return;
    }
    let progressButton = container.querySelector(".read-progress-button");
    if (!progressButton) {
      progressButton = document.createElement("button");
      progressButton.className =
        "mantine-focus-never mantine-active px-0 m_77c9d27d mantine-Button-root m_87cf2631 mantine-UnstyledButton-root read-progress-button";
      progressButton.setAttribute("data-variant", "transparent");
      progressButton.setAttribute("type", "button");
      progressButton.style.cssText =
        "--button-bg: transparent; --button-hover: transparent; --button-color: var(--mantine-color-primary-light-color); --button-bd: calc(0.0625rem * var(--mantine-scale)) solid transparent;";
      const percentage = totalItems > 0 ? ((ignoredCount / totalItems) * 100).toFixed(1) : "0.0";
      progressButton.innerHTML = `
              <span class="m_80f1301b mantine-Button-inner">
                  <span class="m_811560b9 mantine-Button-label">
                      <div class="flex items-center gap-1 text-$mantine-primary-color-light-color">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-eye w-6 h-6">
                              <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path>
                              <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"></path>
                          </svg>
                          <div class="font-semibold text-lg progress-text">
                              <span>${percentage}%</span>
                          </div>
                      </div>
                  </span>
              </span>
          `;
      progressButton.addEventListener("mouseenter", () => {
        const textDiv = progressButton.querySelector(".progress-text");
        if (textDiv) {
          textDiv.innerHTML = `<span>${ignoredCount}/${totalItems}</span>`;
        }
      });
      progressButton.addEventListener("mouseleave", () => {
        const textDiv = progressButton.querySelector(".progress-text");
        if (textDiv) {
          textDiv.innerHTML = `<span>${percentage}%</span>`;
        }
      });

      // 添加左键点击复制进度数功能
      progressButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const progressText = `${ignoredCount}`;
        navigator.clipboard.writeText(progressText).then(() => {
          log(`已复制进度到剪贴板: ${progressText}`);
        }).catch(err => {
          warn("复制进度失败:", err);
        });
      });

      // 添加右键点击复制比例功能
      progressButton.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const percentageText = `${percentage}%`;
        navigator.clipboard.writeText(percentageText).then(() => {
          log(`已复制比例到剪贴板: ${percentageText}`);
        }).catch(err => {
          warn("复制比例失败:", err);
        });
      });

      const targetButton = container.querySelector("button:nth-child(5)");
      if (targetButton) {
        container.insertBefore(progressButton, targetButton);
      } else {
        container.appendChild(progressButton);
      }
    } else {
      const percentage = totalItems > 0 ? ((ignoredCount / totalItems) * 100).toFixed(1) : "0.0";
      const textDiv = progressButton.querySelector(".progress-text");
      if (!textDiv) {
        debugLog("未找到进度文本元素，跳过更新");
        return;
      }
      textDiv.innerHTML = `<span>${percentage}%</span>`;
      const existingEnter = progressButton._mouseenterHandler;
      const existingLeave = progressButton._mouseleaveHandler;
      if (existingEnter) {
        progressButton.removeEventListener("mouseenter", existingEnter);
      }
      if (existingLeave) {
        progressButton.removeEventListener("mouseleave", existingLeave);
      }
      const enterHandler = () => {
        if (textDiv) {
          textDiv.innerHTML = `<span>${ignoredCount}/${totalItems}</span>`;
        }
      };
      const leaveHandler = () => {
        if (textDiv) {
          textDiv.innerHTML = `<span>${percentage}%</span>`;
        }
      };
      progressButton.addEventListener("mouseenter", enterHandler);
      progressButton.addEventListener("mouseleave", leaveHandler);
      progressButton._mouseenterHandler = enterHandler;
      progressButton._mouseleaveHandler = leaveHandler;
    }
  };
  // 缓存页面参数，避免重复获取和日志
  let pageParamCache = null;
  let pageParamCacheTime = 0;
  const CACHE_DURATION = 5000; // 5秒缓存

  const getPage = () => {
    const page = Number(window.location.pathname.split("/").pop()) || 1;
    debugLog(`当前页码: ${page}`);
    return page;
  };

  // 记录当前阅读页数
  const saveCurrentReadPage = (page) => {
    ls.set(LAST_READ_PAGE_KEY, page);
    debugLog(`已保存当前阅读页数: ${page}`);
  };

  // 获取上次阅读页数
  const getLastReadPage = () => {
    const lastPage = ls.get(LAST_READ_PAGE_KEY);
    return lastPage || 1;
  };


  const getPageParam = async (forceRefresh = false) => {
    const now = Date.now();

    // 检查缓存是否有效
    if (!forceRefresh && pageParamCache && (now - pageParamCacheTime) < CACHE_DURATION) {
      debugLog("使用缓存的页面参数");
      return pageParamCache;
    }

    debugLog("开始获取页面参数...");
    const page = getPage();

    try {
      debugLog("等待页面大小元素...");
      const pageSizeSelector =
        "div.flex.items-center.justify-center.px-2.pt-1.pb-1 > div > button:nth-child(3) > span";
      const pageSizeElement = await waitForElement(pageSizeSelector);
      const pageSize = Number(pageSizeElement.textContent);
      debugLog(`页面大小: ${pageSize}`);

      debugLog("检查排序顺序...");
      const newAtFirstSelector =
        "div.flex.items-center.justify-center.px-2.pt-1.pb-1 > div > button:nth-child(1) > span > svg";
      const newAtFirstElement = await waitForElement(newAtFirstSelector);
      const newAtFirst = newAtFirstElement.classList.contains("tabler-icon-sort-descending");
      debugLog(`排序方式: ${newAtFirst ? '最新在前' : '最旧在前'}`);

      debugLog("获取总页数...");
      const allPageSelector =
        "div.flex.items-center.justify-center.px-2.pt-1.pb-1 > div > div > div > button > div";
      const allPageElement = await waitForElement(allPageSelector);
      const allPage = Number(allPageElement.textContent);
      debugLog(`总页数: ${allPage}`);

      const params = { page, pageSize, newAtFirst, allPage };

      // 更新缓存
      pageParamCache = params;
      pageParamCacheTime = now;

      log("页面参数获取完成");
      return params;
    } catch (error) {
      warn("获取页面参数失败:", error);
      // 如果有旧缓存，返回旧缓存
      if (pageParamCache) {
        debugLog("使用过期缓存作为备用");
        return pageParamCache;
      }
      throw error;
    }
  };
  const loadStoredPage = () => {
    log("加载存储的页面状态...");
    const defaultState = { page: 1, pageSize: 20, newAtFirst: true };
    const storedState = ls.get(STORAGE_KEY);
    if (storedState) {
      log("找到存储状态");
    } else {
      log("使用默认页面状态");
    }
    return storedState || defaultState;
  };
  const debouncedSavePageState = (state) => {
    if (saveStateTimeout) {
      clearTimeout(saveStateTimeout);
    }
    saveStateTimeout = setTimeout(() => {
      log("保存页面状态");
      ls.set(STORAGE_KEY, state);
    }, 300);
  };

  let processedItemCount = 0; // 当前页已处理的文章数量
  const filterArticlesByReadCount = async () => {
    log(`开始过滤已读${getFilterCount()}篇以上的文章`);

    // 清除页面参数缓存，强制刷新
    pageParamCache = null;
    pageParamCacheTime = 0;

    // 断开旧的 observer
    if (articleObserver) {
      articleObserver.disconnect();
      articleObserver = null;
      debugLog("已断开旧的 article observer");
    }

    let articleList;
    try {
      // 等待虚拟列表内容加载
      debugLog("等待虚拟列表内容加载...");
      const listResult = await waitForVirtualListContent({
        timeout: 12000, // 12秒超时
        minItems: 1,
        maxEmptyChecks: 30
      });

      if (listResult.timeout && listResult.count === 0) {
        warn("虚拟列表加载超时且无内容");
        return false;
      }

      articleList = listResult.container;
      debugLog(`虚拟列表已加载，总项: ${listResult.items.length}, 可见项: ${listResult.count}`);

      // 重置计数器，因为这是新页面
      processedItemCount = 0;

    } catch (error) {
      warn("等待虚拟列表失败:", error);
      // 降级到原始方法
      articleList = await waitForElement(SELECTORS.ARTICLE.LIST);
      if (!articleList) {
        warn("未找到文章列表容器");
        return false;
      }
      processedItemCount = 0;
    }
      const processEyeIcon = (icon) => {
      const item = icon.closest(SELECTORS.ARTICLE.ITEM);
      if (!item) {
        debugLog("未找到文章项，跳过处理");
        return;
      }

      processedItemCount++; // ←← 关键：每出现一条文章就递增

      const titleElement = item.querySelector(".font-semibold");
      const contentElement = item.querySelector("._text_1alq7_1");
      const articleContent = `${titleElement?.textContent || ""}`;

      const iconParent = icon.closest(".flex.items-center.gap-1");
      if (!iconParent) {
        debugLog("未找到阅读数父元素，跳过处理");
        return;
      }

      const readCountText = iconParent.textContent.trim();
      const readCount = parseInt(readCountText, 10);
      if (isNaN(readCount)) {
        warn("无法找到有效阅读数");
        return;
      }

      const filterCount = getFilterCount();
      if (filterCount > 0 && readCount >= filterCount) {
        item.style.display = "none";
        addToIgnoreSet(articleContent);
        debugLog(`隐藏文章 (已读${readCount}篇)`);
        // 立即更新阅读进度显示
        updateReadProgressDisplay();
      } else {
        item.style.display = "";
        debugLog(`显示文章 (已读${readCount}篇)`);
      }
    };

    articleObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && node.matches("svg.tabler-icon-eye")) {
                processEyeIcon(node);
              }
              const icons = node.querySelectorAll("svg.tabler-icon-eye");
              icons.forEach(processEyeIcon);
            }
          });
        }
      }
      autoPageIfListEmpty();
    });
    const observerConfig = {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    };
    articleObserver.observe(articleList, observerConfig);
    const existingIcons = articleList.querySelectorAll("svg.tabler-icon-eye");
    existingIcons.forEach(processEyeIcon);
    setTimeout(() => {
      autoPageIfListEmpty();
      log(`开始更新进度显示，当前ignoreSet大小: ${getIgnoreSet().size}`);
      updateReadProgressDisplay();
    }, 2e3);
    log(`过滤器设置完成`);
    return true;
  };

  function findPageButtonByIcon(direction) {
    const container = document.querySelector(SELECTORS.PAGINATION.CONTAINER);
    if (!container) {
      warn("未找到分页容器");
      return null;
    }

    const svgClass =
      direction === "prev"
        ? "tabler-icon-chevron-left"
        : "tabler-icon-chevron-right";

    const svg = container.querySelector(`svg.${svgClass}`);
    if (!svg) {
      warn(`未找到${direction}分页图标`);
      return null;
    }

    const button = svg.closest("button");
    if (!button) {
      warn(`未找到${direction}分页按钮`);
      return null;
    }

    log(`找到${direction}分页按钮，状态: ${button.disabled ? '禁用' : '可用'}`);
    return button;
  }

  const clickPageButton = async (direction) => {
    try {
      if (direction !== "prev" && direction !== "next") {
        warn(`无效的方向: ${direction}`);
        return false;
      }

      const button = findPageButtonByIcon(direction);
      if (!button) {
        warn(`未找到${direction}方向按钮`);
        return false;
      }

      if (button.disabled || button.classList.contains("disabled")) {
        log(`${direction}方向按钮已禁用`);
        return false;
      }

      log(`点击${direction}分页按钮`);
      button.click();
      return true;
    } catch (error) {
      warn(`点击${direction}分页按钮失败:`, error);
      return false;
    }
  };

  const navigateToPage = async (direction) => {
    try {
      if (direction !== "prev" && direction !== "next") {
        warn(`无效的方向: ${direction}`);
        return false;
      }

      // 获取当前页面参数
      const pageParams = await getPageParam();
      if (!pageParams) {
        warn("无法获取页面参数");
        return false;
      }

      // 计算目标页码
      let targetPage;
      if (direction === "prev") {
        targetPage = pageParams.page - 1;
        // 检查是否已经是第一页
        if (targetPage < 1) {
          log("已经是第一页，无法继续向前翻页");
          return false;
        }
      } else {
        targetPage = pageParams.page + 1;
        // 检查是否已经超出总页数
        if (targetPage > pageParams.allPage) {
          log("已经是最后一页，无法继续向后翻页");
          return false;
        }
      }

      // 构建目标URL并导航
      const targetUrl = `/home/read/published/${targetPage}`;
      log(`导航到${direction}页面: ${targetPage}`);

      // 保存当前页面的阅读记录
      saveCurrentReadPage(pageParams.page);

      // 清除页面参数缓存，准备页面跳转
      pageParamCache = null;
      pageParamCacheTime = 0;

      // 执行路由跳转
      window.location.href = targetUrl;
      return true;
    } catch (error) {
      warn(`导航到${direction}页面失败:`, error);
      return false;
    }
  };

  async function isPageFullyLoaded() {
    try {
      // 先等待页面稳定
      debugLog("检查页面是否完全加载...");
      const stableResult = await waitForPageStable({
        timeout: 6000,
        checkInterval: 200,
        stableChecks: 2
      });

      if (stableResult.timeout) {
        debugLog("页面稳定检查超时，使用当前状态");
      }

      const pageParams = await getPageParam();
      const expected = pageParams.pageSize;

      debugLog(`列表检查: 已处理${processedItemCount}条，预期${expected}条`);

      // 若当前页为最后一页，则视为列表完全加载
      if (pageParams.page >= pageParams.allPage) {
        debugLog("当前为最后一页，视为完全加载");
        return true;
      }

      // 等待虚拟列表内容
      const listResult = await waitForVirtualListContent({
        timeout: 8000,
        minItems: expected,
        maxEmptyChecks: 20
      });

      if (listResult.timeout && listResult.count < expected) {
        debugLog(`虚拟列表未完全加载，当前${listResult.count}项，预期${expected}项`);
        return false;
      }

      debugLog(`列表完全加载: ${listResult.count}/${expected}项`);
      return true;

    } catch (error) {
      debugLog(`页面加载检查失败: ${error.message}`);
      // 降级检查
      const list = document.querySelector(SELECTORS.ARTICLE.LIST);
      if (!list) return false;

      const items = list.querySelectorAll(SELECTORS.ARTICLE.ITEM);
      return processedItemCount >= items.length;
    }
  }

  async function autoPageIfListEmpty() {
    try {
      // 检查自动翻页功能是否启用
      if (!getAutoPageEnabled()) {
        debugLog("自动翻页功能已禁用，跳过检查");
        return;
      }

      // 如果正在自动翻页中，跳过
      if (isAutoPaging) {
        debugLog("正在执行自动翻页，跳过检查");
        return;
      }

      // 如果已经有一个自动翻页定时器在运行，跳过
      if (autoPageTimer) {
        debugLog("自动翻页定时器已在运行，跳过");
        return;
      }

      // 如果在冷却期，跳过
      if (autoPageCooldown) {
        debugLog("自动翻页冷却期，跳过检查");
        return;
      }

      // 简单检查：如果已经处理了足够的文章，且没有可见内容，就翻页
      if (processedItemCount >= 20) { // 使用固定的每页文章数
        const list = document.querySelector(SELECTORS.ARTICLE.LIST);
        if (list) {
          const visibleItems = Array.from(list.querySelectorAll(SELECTORS.ARTICLE.ITEM)).filter((item) => {
            const hasContent = item.querySelector(".font-semibold") ||
                              item.querySelector("._text_1alq7_1") ||
                              item.querySelector("svg.tabler-icon-eye");
            return item.style.display !== "none" && hasContent;
          });

          if (visibleItems.length === 0) {
            const interval = getAutoPageInterval();
            log(`本页全部被过滤，${interval/1000}秒后自动翻页`);

            // 设置冷却标志，防止重复触发
            autoPageCooldown = true;

            autoPageTimer = setTimeout(async () => {
              try {
                // 标记正在执行自动翻页
                isAutoPaging = true;

                const direction = getAutoPageDirection();
                log(`执行自动翻页 → ${direction}`);

                // 清除页面参数缓存，翻页后强制刷新
                pageParamCache = null;
                pageParamCacheTime = 0;

                // 翻页后计数归零
                processedItemCount = 0;

                // 执行翻页操作（点击翻页按钮）
                const pageSuccess = await clickPageButton(direction);

                if (pageSuccess) {
                  // 等待一小段时间让页面开始加载
                  await new Promise(resolve => setTimeout(resolve, 500));

                  // 检查是否启用了自动刷新
                  if (getAutoRefresh()) {
                    // 尝试多种刷新方法确保内容加载
                    debugLog("翻页成功，开始刷新内容");

                    // 方法1: 执行下拉刷新
                    const refreshSuccess = await simulatePullToRefresh();

                    if (!refreshSuccess) {
                      // 如果下拉刷新失败，尝试强制重载
                      debugLog("下拉刷新失败，尝试强制重载");
                      await forceReloadContent();
                    }

                    // 等待内容加载完成
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // 刷新后检查是否还有内容
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 额外等待2秒
                    const listAfterRefresh = document.querySelector(SELECTORS.ARTICLE.LIST);
                    if (listAfterRefresh) {
                      const visibleItemsAfterRefresh = Array.from(listAfterRefresh.querySelectorAll(SELECTORS.ARTICLE.ITEM)).filter((item) => {
                        const hasContent = item.querySelector(".font-semibold") ||
                                          item.querySelector("._text_1alq7_1") ||
                                          item.querySelector("svg.tabler-icon-eye");
                        return item.style.display !== "none" && hasContent;
                      });

                      // 如果刷新后仍然没有可见内容，继续翻页
                      if (visibleItemsAfterRefresh.length === 0) {
                        debugLog("刷新后仍无可见内容，准备继续翻页");
                        // 设置标记，让过滤完成后再次触发自动翻页
                        processedItemCount = 20; // 设置为足够触发翻页的数量
                      }
                    }
                  } else {
                    debugLog("自动刷新已禁用，跳过刷新操作");
                    // 即使禁用刷新，也等待一段时间让页面自然加载
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }

                  // 再次触发过滤以确保新页面内容被正确处理
                  setTimeout(() => {
                    filterArticlesByReadCount();
                    // 如果设置了需要继续翻页的标记，延迟后再次检查
                    if (processedItemCount >= 20) {
                      setTimeout(() => {
                        autoPageIfListEmpty();
                      }, 3000);
                    }
                  }, 1500);
                }
              } finally {
                autoPageTimer = null;
                isAutoPaging = false;

                // 延长冷却时间，避免新页面立即再次触发
                setTimeout(() => {
                  autoPageCooldown = false;
                  debugLog("自动翻页冷却结束");
                }, 3000); // 3秒冷却时间
              }
            }, interval);
          }
        }
      }

    } catch (error) {
      debugLog(`自动翻页检查失败: ${error.message}`);
      autoPageTimer = null;
      isAutoPaging = false;
      autoPageCooldown = false;
    }
  }


  /**
   * 模拟下拉刷新函数
   * @param {string} selector 目标元素的选择器
   * @param {number} distance 下拉距离（像素），默认 300
   */
  async function simulatePullToRefresh(selector = '[data-overlayscrollbars-viewport]', distance = 300) {
    const el = document.querySelector(selector);
    if (!el) {
      // 尝试备用选择器
      const fallbackSelectors = [
        '._scroller_1tdu5_1',
        SELECTORS.ARTICLE.LIST,
        '[data-scrollbar]',
        '.overflow-auto'
      ];

      for (const fallbackSelector of fallbackSelectors) {
        const fallbackEl = document.querySelector(fallbackSelector);
        if (fallbackEl) {
          el = fallbackEl;
          debugLog(`使用备用选择器: ${fallbackSelector}`);
          break;
        }
      }

      if (!el) {
        debugLog("未找到目标元素，无法执行下拉刷新");
        return false;
      }
    }

    // 辅助函数：创建并触发触摸事件
    const fireTouch = (type, y) => {
      const touch = new Touch({
        identifier: Date.now(),
        target: el,
        clientX: 0,
        clientY: y,
        pageY: y,
        radiusX: 2.5,
        radiusY: 2.5,
        rotationAngle: 10,
        force: 0.5,
      });

      const event = new TouchEvent(type, {
        cancelable: true,
        bubbles: true,
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
      });

      el.dispatchEvent(event);
    };

    debugLog("开始模拟下拉刷新...");

    // 获取元素位置
    const rect = el.getBoundingClientRect();
    const startY = rect.top + 50;
    const endY = startY + distance;

    try {
      // 1. 触发 touchstart
      fireTouch('touchstart', startY);

      // 2. 模拟滑动过程
      const steps = 30;
      for (let i = 0; i <= steps; i++) {
        const currentY = startY + (distance * (i / steps));
        fireTouch('touchmove', currentY);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 3. 触发 touchend
      fireTouch('touchend', endY);

      debugLog("下拉刷新模拟完成");
      return true;
    } catch (error) {
      debugLog(`下拉刷新失败: ${error.message}`);
      return false;
    }
  }

  // 强制重新加载页面内容
  const forceReloadContent = async () => {
    // 检查用户是否启用了自动刷新
    if (!getAutoRefresh()) {
      debugLog("自动刷新功能已禁用，跳过强制重载");
      return false;
    }

    debugLog("强制重新加载页面内容");
    try {
      // 方法1: 触发窗口大小变化事件
      const originalHeight = window.innerHeight;
      window.innerHeight = originalHeight - 1;
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 100));
      window.innerHeight = originalHeight;
      window.dispatchEvent(new Event('resize'));

      // 方法2: 触发自定义刷新事件
      const refreshEvent = new CustomEvent('forceRefresh', { bubbles: true });
      document.dispatchEvent(refreshEvent);

      // 方法3: 如果前两种方法无效，尝试直接点击刷新相关元素
      const sortButton = document.querySelector(SELECTORS.PAGINATION.SORT_BUTTON);
      if (sortButton && !sortButton.disabled) {
        debugLog("点击排序按钮触发内容刷新");
        sortButton.click();
        // 再次点击恢复原状态
        await new Promise(resolve => setTimeout(resolve, 200));
        sortButton.click();
      }

      debugLog("强制内容重载操作完成");
      return true;
    } catch (error) {
      debugLog(`强制内容重载失败: ${error.message}`);
      return false;
    }
  };

  // 重置页面状态
  const resetPageState = () => {
    debugLog("重置页面状态");
    processedItemCount = 0;
    pageParamCache = null;
    pageParamCacheTime = 0;
    isProcessing = false;
    // 注意：不重置自动翻页相关标志，以保持防护机制
  };

  const processPage = async () => {
    const currentPath = window.location.pathname;
    if (isProcessing && currentPath !== lastProcessedPath) {
      log("路径变化，重置状态");
      resetPageState();
    }
    if (isProcessing) {
      log("正在处理中，跳过");
      return;
    }
    isProcessing = true;
    lastProcessedPath = currentPath;
    try {
      if (currentPath.match(/^\/home\/read\/published\/\d+$/)) {
        log("处理编号页面...");
        const pageParam = await getPageParam();
        log(`当前页面状态: 页码 ${pageParam.page}, 每页 ${pageParam.pageSize}`);
        debouncedSavePageState(pageParam);

        // 记录当前阅读页数
        saveCurrentReadPage(pageParam.page);

        await filterArticlesByReadCount();
        setTimeout(() => {
          log(`页面初始化时更新进度，ignoreSet大小: ${getIgnoreSet().size}`);
          updateReadProgressDisplay();
        }, 3000);
      } else if (
        currentPath === "/home/read/published" ||
        currentPath === "/home/read/published/"
      ) {
        log("处理根路径...");
        const storedState = loadStoredPage();
        const lastReadPage = getLastReadPage();

        // 优先恢复到上次阅读页数，如果没有则使用存储状态
        // 检查是否需要恢复（有记录的页数大于1）
        const needRestore = lastReadPage > 1 || storedState.page > 1;

        if (needRestore && !hasRestoredPage) {
          const targetPage = lastReadPage > 1 ? lastReadPage : storedState.page;
          log(`恢复到上次阅读页数: ${targetPage} (上次阅读:${lastReadPage}, 存储状态:${storedState.page})`);
          hasRestoredPage = true;

          // 立即跳转，使用 window.location.href 避免被网站拦截
          window.location.href = `/home/read/published/${targetPage}`;
          return;
        }

        // 初始化页面时显示进度
        setTimeout(() => {
          log(`根路径页面初始化时更新进度，ignoreSet大小: ${getIgnoreSet().size}`);
          updateReadProgressDisplay();
        }, 3000);
      }
    } catch (error) {
      warn("处理过程中出错:", error);
    } finally {
      isProcessing = false;
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      debugLog("页面变为可见，检查状态...");
      const currentPath = window.location.pathname;
      const match = currentPath.match(/^\/home\/read\/published\/(\d+)$/);
      const currentPage = match ? parseInt(match[1], 10) : 1;
      const lastReadPage = getLastReadPage();

      debugLog(`当前页面: ${currentPage}, 上次阅读页数: ${lastReadPage}`);

      // 如果在根路径且有记录的阅读页数，立即恢复
      if ((currentPath === "/home/read/published" || currentPath === "/home/read/published/") && lastReadPage > 1) {
        hasRestoredPage = false;
        log(`页面可见，立即从根路径恢复到页数 ${lastReadPage}`);
        window.location.href = `/home/read/published/${lastReadPage}`;
      } else if (currentPage > 0) {
        // 如果在具体页面，更新记录
        saveCurrentReadPage(currentPage);
        debugLog(`更新当前阅读页数: ${currentPage}`);
        setTimeout(async () => {
          debugLog("页面可见，检查是否需要更新过滤");

          // 只有在自动刷新启用时才刷新内容
          if (getAutoRefresh()) {
            await simulatePullToRefresh();
            // 等待一小段时间让内容加载
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // 然后更新过滤
          filterArticlesByReadCount();
        }, 1000);
      }
    }
  });

  let lastPath = window.location.pathname;
  // 监听 URL 变化的更可靠方法
  const checkRouteChange = () => {
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      log(`路由变化: ${lastPath} → ${currentPath}`);

      // 如果是从具体页面跳转，记录当前页数
      const match = lastPath.match(/^\/home\/read\/published\/(\d+)$/);
      if (match) {
        const pageFrom = parseInt(match[1], 10);
        saveCurrentReadPage(pageFrom);
        log(`从页面 ${pageFrom} 跳转，已保存`);
      }

      lastPath = currentPath;

      // 重置 hasRestoredPage 标志，以便在新路径上可以重新恢复
      hasRestoredPage = false;

      // 如果当前路径是根路径且有记录的页数，立即处理
      if ((currentPath === "/home/read/published" || currentPath === "/home/read/published/")) {
        const lastReadPage = getLastReadPage();
        if (lastReadPage > 1) {
          log(`检测到根路径，准备恢复到页数 ${lastReadPage}`);
          // 直接处理，不等待
          processPage();
          return;
        }
      }

      // 重置状态并延迟处理
      resetPageState();
      setTimeout(async () => {
        await processPage();
        // 如果是分页路径变化，尝试刷新内容（仅在启用自动刷新时）
        if (currentPath.match(/^\/home\/read\/published\/\d+$/)) {
          setTimeout(async () => {
            if (getAutoRefresh()) {
              debugLog("分页路由变化，尝试刷新内容");
              await simulatePullToRefresh();
            }
          }, 1000);
        }
      }, 300);
    }
  };

  // 使用多种方式监听路由变化
  const routeObserver = new MutationObserver(checkRouteChange);
  routeObserver.observe(document.body, { childList: true, subtree: true });

  // 监听 popstate 事件（浏览器前进后退）
  window.addEventListener('popstate', checkRouteChange);

  // 监听 hashchange 事件
  window.addEventListener('hashchange', checkRouteChange);

  // 定时检查路由变化（作为备用）
  setInterval(checkRouteChange, 1000);
  const setupSortButtonListener = async () => {
    const sortButton = await waitForElement(SELECTORS.PAGINATION.SORT_BUTTON);
    if (!sortButton) {
      warn("未找到排序按钮");
      return;
    }
    log("设置排序按钮监听器");
    sortButton.addEventListener("click", () => {
      log("排序按钮被点击，触发过滤");
      setTimeout(() => {
        filterArticlesByReadCount();
      }, 500);
    });
  };
  const initialize = async () => {
    // 初始化时重置所有状态
    processedItemCount = 0;
    pageParamCache = null;
    pageParamCacheTime = 0;
    clearTimeout(autoPageTimer);
    autoPageTimer = null;
    isAutoPaging = false;
    autoPageCooldown = false;
    isProcessing = false;
    hasRestoredPage = false;

    // 断开旧的 observer
    if (articleObserver) {
      articleObserver.disconnect();
      articleObserver = null;
    }

    await setupSortButtonListener();
    registerMenuCommands();

    // 检查自动翻页开关状态
    const autoPageEnabled = getAutoPageEnabled();
    log(`自动翻页功能${autoPageEnabled ? '已启用' : '已禁用'}`);

    processPage();
  };
  getFilterCount();
  initialize();
})();
