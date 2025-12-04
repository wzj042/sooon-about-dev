// ==UserScript==
// @name         素问通读助手
// @namespace    npm/vite-plugin-monkey
// @version      1.1.1
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
  let hasRestoredPage = false;
  let isProcessing = false;
  let lastProcessedPath = null;
  let saveStateTimeout = null;
  let autoPageTimer = null;
  let lastListCheckTime = 0;
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
  };
  const calculateReadProgress = async () => {
    try {
      // 获取页面参数来计算总文章数
      const pageParam = await getPageParam();
      const totalItems = pageParam.pageSize * pageParam.allPage;

      // 直接使用 ignoreSet 的大小作为已忽略文章数
      const ignoreSet = getIgnoreSet();
      const ignoredCount = ignoreSet.size;

      log(`总文章数: ${totalItems} (每页${pageParam.pageSize} × ${pageParam.allPage}页)`);
      log(`ignoreSet中的已忽略文章数: ${ignoredCount}`);

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
    if (!container) return;
    let progressButton = container.querySelector(".read-progress-button");
    if (!progressButton) {
      progressButton = document.createElement("button");
      progressButton.className =
        "mantine-focus-never mantine-active px-0 m_77c9d27d mantine-Button-root m_87cf2631 mantine-UnstyledButton-root read-progress-button";
      progressButton.setAttribute("data-variant", "transparent");
      progressButton.setAttribute("type", "button");
      progressButton.style.cssText =
        "--button-bg: transparent; --button-hover: transparent; --button-color: var(--mantine-color-primary-light-color); --button-bd: calc(0.0625rem * var(--mantine-scale)) solid transparent;";
      const percentage = ((ignoredCount / totalItems) * 100).toFixed(1);
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
      const percentage = ((ignoredCount / totalItems) * 100).toFixed(1);
      const textDiv = progressButton.querySelector(".progress-text");
      if (textDiv) {
        textDiv.innerHTML = `<span>${percentage}%</span>`;
      }
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
  const getPage = () => {
    const page = Number(window.location.pathname.split("/").pop()) || 1;
    log(`当前页码: ${page}`);
    return page;
  };
  const getPageParam = async () => {
    log("开始获取页面参数...");
    const page = getPage();
    log("等待页面大小元素...");
    const pageSizeSelector =
      "div.flex.items-center.justify-center.px-2.pt-1.pb-1 > div > button:nth-child(3) > span";
    const pageSize = Number(
      (await waitForElement(pageSizeSelector)).textContent
    );
    log(`页面大小: ${pageSize}`);
    log("检查排序顺序...");
    const newAtFirstSelector =
      "div.flex.items-center.justify-center.px-2.pt-1.pb-1 > div > button:nth-child(1) > span > svg";
    const newAtFirst = (
      await waitForElement(newAtFirstSelector)
    ).classList.contains("tabler-icon-sort-descending");
    log(`排序方式: ${newAtFirst ? '最新在前' : '最旧在前'}`);
    log("获取总页数...");
    const allPageSelector =
      "div.flex.items-center.justify-center.px-2.pt-1.pb-1 > div > div > div > button > div";
    const allPage = Number((await waitForElement(allPageSelector)).textContent);
    log(`总页数: ${allPage}`);
    const params = { page, pageSize, newAtFirst, allPage };
    log("页面参数获取完成");
    return params;
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
    const articleList = await waitForElement(SELECTORS.ARTICLE.LIST);
    if (!articleList) {
      warn("未找到文章列表容器");
      return false;
    }
      const processEyeIcon = (icon) => {
      const item = icon.closest(SELECTORS.ARTICLE.ITEM);
      if (!item) return;

      processedItemCount++; // ←← 关键：每出现一条文章就递增
      log(`已处理条目: ${processedItemCount}`);

      const titleElement = item.querySelector(".font-semibold");
      const contentElement = item.querySelector("._text_1alq7_1");
      const articleContent = `${titleElement?.textContent || ""}`;

      const iconParent = icon.closest(".flex.items-center.gap-1");
      if (!iconParent) return;

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
        log(`隐藏文章 (已读${readCount}篇)`);
        // 立即更新阅读进度显示
        updateReadProgressDisplay();
      } else {
        item.style.display = "";
        log(`显示文章 (已读${readCount}篇)`);
      }
    };

    const observer = new MutationObserver((mutations) => {
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
    observer.observe(articleList, observerConfig);
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

  async function isPageFullyLoaded() {
    const pageParams = await getPageParam();
    const expected = pageParams.pageSize;

    log(`列表检查: 已处理${processedItemCount}条，预期${expected}条`);
    // 若当前页为最后一页，则视为列表完全加载
    if (pageParams.page >= pageParams.allPage) {
      log("当前为最后一页，视为完全加载");
      return true;
    }
    // 若出现条目数量达到 pageSize 才视为列表完全加载
    return processedItemCount >= expected;
  }

  async function autoPageIfListEmpty() {
    if (!(await isPageFullyLoaded())) {
      log("列表未完全加载，跳过翻页");
      return;
    }

    const list = document.querySelector(SELECTORS.ARTICLE.LIST);
    if (!list) return;

    const visibleItems = Array.from(
      list.querySelectorAll(SELECTORS.ARTICLE.ITEM)
    ).filter((item) => item.style.display !== "none");

    if (visibleItems.length === 0) {
      const interval = getAutoPageInterval();
      log(`本页全部被过滤，${interval/1000}秒后自动翻页`);

      clearTimeout(autoPageTimer);
      autoPageTimer = setTimeout(async () => {
        if (visibleItems.length === 0) {
          const direction = getAutoPageDirection();
          log(`执行自动翻页 → ${direction}`);

          // 翻页后计数归零
          processedItemCount = 0;

          await clickPageButton(direction);
        } else {
          log("出现可见条目，取消翻页");
        }
      }, interval);
    }
  }

  const processPage = async () => {
    const currentPath = window.location.pathname;
    if (isProcessing && currentPath !== lastProcessedPath) {
      log("路径变化，重置状态");
      isProcessing = false;
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
        debouncedSavePageState(pageParam);
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
        if (!hasRestoredPage && storedState.page > 1) {
          log(`恢复到存储页面 ${storedState.page}`);
          hasRestoredPage = true;
          window.location.href = `/home/read/published/${storedState.page}`;
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
      log("页面变为可见，检查状态...");
      const currentPath = window.location.pathname;
      const match = currentPath.match(/^\/home\/read\/published\/(\d+)$/);
      const currentPage = match ? parseInt(match[1], 10) : 1;
      const storedState = loadStoredPage();
      if (currentPage !== storedState.page) {
        hasRestoredPage = false;
        processPage();
      }
    }
  });
  let lastPath = window.location.pathname;
  const routeObserver = new MutationObserver(() => {
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      log(`路由变化: ${lastPath} → ${currentPath}`);
      lastPath = currentPath;
      isProcessing = false;
      processPage();
    }
  });
  routeObserver.observe(document.body, { childList: true, subtree: true });
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
    await setupSortButtonListener();
    registerMenuCommands();
    processPage();
  };
  getFilterCount();
  initialize();
})();
