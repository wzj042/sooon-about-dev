// ==UserScript==
// @name         素问抢答题库提取助手
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在 sooon.ai 页面注入按钮：提取 / 导出 / 导入 JSON 数据
// @author       wzj042
// @icon         https://sooon.ai/assets/favicon-BRntVMog.ico
// @match        https://sooon.ai/home/read/feed*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
// TODO： 增加类型分类功能，识别是否包含 查询原文按钮，支持搜索。存入答案是一并将 问题：答案 存入 questionData 中
(function () {
    "use strict";
    const LOCAL_KEY = "sooonQuestionBank";

    /* -------------------------------------------------
     * 工具：把 JSON 对象下载到本地
     * -------------------------------------------------*/
    const downloadJSON = (obj, filename) => {
        const blob = new Blob([JSON.stringify(obj, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /* -------------------------------------------------
     * 导入数据：选择文件 → 合并到 localStorage
     * -------------------------------------------------*/
    const importData = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.style.display = "none";
        document.body.appendChild(input);

        input.addEventListener("change", () => {
            const file = input.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (typeof imported !== "object" || imported === null)
                        throw new Error("非对象 JSON");

                    const raw = localStorage.getItem(LOCAL_KEY);
                    const local = raw ? JSON.parse(raw) : {};

                    let addCnt = 0;
                    for (const k in imported) {
                        if (!(k in local)) addCnt++;
                        local[k] = imported[k];
                    }

                    localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
                    alert(
                        `导入完成！新增 ${addCnt} 条，当前共 ${Object.keys(local).length
                        } 条。`
                    );
                } catch (err) {
                    alert("导入失败：" + err.message);
                } finally {
                    document.body.removeChild(input);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    };

    /* -------------------------------------------------
     * 导出数据：把 localStorage 中的 LOCAL_KEY 下载
     * -------------------------------------------------*/
    const exportData = () => {
        const data = localStorage.getItem(LOCAL_KEY);
        if (!data) {
            alert("没有找到可导出的数据，请先提取数据");
            return;
        }
        try {
			const json = JSON.parse(data);
			// 过滤：不导出 answer 为 -1 的项
			const filtered = {};
			for (const [k, v] of Object.entries(json)) {
				if (!v || typeof v !== "object") continue;
				if (v.answer === -1) continue;
				filtered[k] = v;
			}
            // const filename = `sooon_data_${new Date()
            //     .toISOString()
            //     .slice(0, 19)
            //     .replace(/:/g, "-")}.json`;
            // sooon_data_2025-09-15 16:26:35.json
            const filename = `sooon_question_bank_${new Date()
                .toLocaleString()
                .slice(0, 19)
                .replace(/_/g, "-")
                .replace(/\//g, "-")}.json`;
			downloadJSON(filtered, filename);
            alert("数据导出成功！");
        } catch (e) {
            alert("导出时出错：" + e.message);
        }
    };

    /* -------------------------------------------------
     * 提取数据：主逻辑（略作容错补全）
     * -------------------------------------------------*/
    const extractData = () => {
        // 若对话框未打开，尝试自动点开
        if (!document.querySelector('[role="dialog"]')) {
            try {
                document
                    .querySelector(
                        "#root > div > main > div.flex.flex-col.w-full.px-2.pt-2.pb-2.min-h-13 > div > div:nth-child(1) > button.mantine-focus-never.flex.items-center.justify-center.h-8.w-8.active\\:translate-y-px.m_87cf2631.mantine-UnstyledButton-root"
                    )
                    .click();
                setTimeout(() => {
                    document
                        .querySelector(
                            "#portal-root > div.fixed.inset-0.isolate.z-\\$mantine-z-index-modal.overflow-hidden > div.fixed.inset-0.overflow-hidden.pointer-events-none.flex.items-center.justify-center.py-8.px-8 > section > div > div > div.outline-none.w-full > div > div > div._children_whrto_2.flex-1 > div > div:nth-child(2) > button:nth-child(4)"
                        )
                        .click();
                }, 500);
            } catch (e) { }
        }

        setTimeout(() => {
            const result = {};
            const keys = document.querySelectorAll(
                "#portal-root > div:nth-child(3) > div.fixed.inset-0.overflow-hidden.pointer-events-none.flex.items-center.justify-center.py-8.px-8 > section > div > div.flex-1.flex.flex-col.overflow-hidden._mask_a535l_1 > div > div.outline-none.w-full > div > div > div._children_whrto_2.flex-1 > div > div.flex.flex-col .font-bold"
            );
            console.log("获取到", keys.length, "个数据");

            keys.forEach((keyEl) => {
                const keyText = keyEl.textContent.trim();
                const parent = keyEl.parentElement;
                console.log("\tQ:", keyText);

                // 获取所有选项
                const allOptions = [];
                let correctAnswer = "";
                let type = 'common_sense';
                const grandParent = parent.parentElement;
                console.log("grandParent:", grandParent);
                // 在 grandParent 下搜索 btn, 若任意 btn 文本为 「阅读原文」则 type 为 sooon_ai
                const btn = grandParent.querySelectorAll("button");
                
                if (btn && btn.forEach((btn) => {
                    if (btn.textContent.trim() === "阅读原文") {
                        type = 'sooon_ai';
                    }
                }));
                // 第一类 UI：button 选项
                const buttons = parent.querySelectorAll("button");
                if (buttons.length > 0) {
                    buttons.forEach((btn) => {
                        const optionText = btn.textContent.trim();
                        if (optionText && optionText !== "(无内容)" && !allOptions.includes(optionText)) {
                            allOptions.push(optionText);
                        }
                        // 检查是否是正确答案（包含 check 图标）
                        if (btn.querySelector("svg.tabler-icon-check")) {
                            correctAnswer = optionText;
                        }
                    });
                }

				result[keyText] = {
                    options: allOptions,
                    // 下标
                    answer: allOptions.indexOf(correctAnswer),
                    // updated_at, 将 2025/9/15 19:05:20 替换为YYYY-MM-DD HH:MM:SS
                    updated_at: new Date().toLocaleString().slice(0, 19).replace(/\//g, "-"),
                    type: type,
                };
				// 日志：标记当前解析未识别到正确答案的问题
				if (result[keyText].answer === -1) {
					console.warn("题目解析疑似异常（未识别正确答案）:", keyText, result[keyText]);
				}
            });

            console.log("本次解析题目数：", Object.keys(result).length);

            // 合并到 localStorage
            const raw = localStorage.getItem(LOCAL_KEY);
            const local = raw ? JSON.parse(raw) : {};
            const originLen = Object.keys(local).length;

            for (const k in result) {
                // 检查是否已存在该题目
                if (k in local) {
                    // 如果已存在，合并选项（去重）
                    const localQuestion = local[k];
                    const resultQuestion = result[k];
                    // 检查答案是否一致
                    if (localQuestion.options[localQuestion.answer] !== resultQuestion.options[resultQuestion.answer]) {
                        console.log("答案不一致，更新：", k);
                        local[k] = resultQuestion;
                    }
                    if (localQuestion.type !== resultQuestion.type) {
                        console.log("类型不一致，更新：", k);
                        local[k] = resultQuestion;
                    }
                } else {
                    // 新题目：直接添加
                    local[k] = result[k];
                }
            }
            localStorage.setItem(LOCAL_KEY, JSON.stringify(local));

            const added = Object.keys(local).length - originLen;
            console.log(
                `数据提取完成，已存入 ${added} 条，当前共 ${Object.keys(local).length
                } 条`
            );
        }, 2500);
    };

    /* -------------------------------------------------
     * 注入三个按钮
     * -------------------------------------------------*/
    const addButtons = () => {
        const css = (txt, top, bg) => {
            const btn = document.createElement("button");
            btn.innerText = txt;
            btn.style.cssText = `
              position:fixed; bottom:${top}px; left:10px; z-index:9999;
              padding:5px 10px; background:${bg}; color:#fff; border:none;
              border-radius:5px; cursor:pointer; margin-bottom:5px;
          `;
            return btn;
        };
        const extractBtn = css("提取数据", 10, "#4CAF50");
        const exportBtn = css("导出数据", 45, "#2196F3");
        const importBtn = css("导入数据", 80, "#ff9800");

        document.body.append(extractBtn, exportBtn, importBtn);
        extractBtn.addEventListener("click", extractData);
        exportBtn.addEventListener("click", exportData);
        importBtn.addEventListener("click", importData);
    };

    /* -------------------------------------------------
     * 启动
     * -------------------------------------------------*/
    if (document.readyState === "complete") addButtons();
    else window.addEventListener("load", addButtons);
})();
