#!/usr/bin/env node
/**
 * 自动生成 script/index.html 的脚本列表
 * 扫描 script 目录下所有包含 user.js 的文件夹，并更新列表
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCRIPT_DIR = path.join(ROOT_DIR, 'script');
const INDEX_FILE = path.join(SCRIPT_DIR, 'index.html');

// 从 HTML 文件中提取标题
function extractTitle(htmlContent) {
    const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : null;
}

// 生成脚本项的 HTML
function generateScriptItem(name, dirName, hasIndex) {
    const idSuffix = dirName.replace(/-/g, '');
    const href = hasIndex ? `${dirName}/index.html` : `${dirName}/user.js`;
    const linkText = hasIndex ? name : `📥 直接下载: ${name}`;

    return `                <li class="script-item">
                    <a href="${href}">
                        <div class="script-name">${linkText}</div>
                        <div class="script-meta">
                            <span>📅 <span id="${idSuffix}-time">加载中...</span></span>
                            <span>📦 <span id="${idSuffix}-size">加载中...</span></span>
                        </div>
                    </a>
                </li>`;
}

// 扫描脚本目录
function scanScriptDirectory() {
    const scripts = [];

    if (!fs.existsSync(SCRIPT_DIR)) {
        console.error('script 目录不存在');
        return scripts;
    }

    const entries = fs.readdirSync(SCRIPT_DIR, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // 跳过 archive 目录
        if (entry.name === 'archive' || entry.name.startsWith('.')) continue;

        const dirPath = path.join(SCRIPT_DIR, entry.name);
        const userJsPath = path.join(dirPath, 'user.js');
        const indexPath = path.join(dirPath, 'index.html');

        // 必须包含 user.js
        if (!fs.existsSync(userJsPath)) continue;

        let scriptName = entry.name;
        let hasIndex = false;

        // 如果有 index.html，从中提取标题
        if (fs.existsSync(indexPath)) {
            try {
                const htmlContent = fs.readFileSync(indexPath, 'utf-8');
                const title = extractTitle(htmlContent);
                if (title) {
                    scriptName = title;
                    hasIndex = true;
                }
            } catch (error) {
                console.warn(`无法读取 ${indexPath}: ${error.message}`);
            }
        }

        scripts.push({
            name: scriptName,
            dirName: entry.name,
            hasIndex,
            hasUserJs: true
        });
    }

    // 按名称排序
    return scripts.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

// 更新 index.html 文件
function updateIndexHtml(scripts) {
    if (!fs.existsSync(INDEX_FILE)) {
        console.error('script/index.html 不存在');
        return false;
    }

    let content = fs.readFileSync(INDEX_FILE, 'utf-8');

    // 生成脚本列表 HTML
    const scriptListHtml = scripts.map(script =>
        generateScriptItem(script.name, script.dirName, script.hasIndex)
    ).join('\n');

    // 替换脚本列表部分
    const listStartMarker = '<ul class="script-list" id="script-list">';
    const listEndMarker = '</ul>';

    const listStartIndex = content.indexOf(listStartMarker);
    const listEndIndex = content.indexOf(listEndMarker, listStartIndex);

    if (listStartIndex === -1 || listEndIndex === -1) {
        console.error('无法找到脚本列表标记');
        return false;
    }

    const newContent =
        content.substring(0, listStartIndex + listStartMarker.length) +
        '\n' + scriptListHtml + '\n            ' +
        content.substring(listEndIndex);

    fs.writeFileSync(INDEX_FILE, newContent, 'utf-8');
    console.log(`✅ 已更新 ${INDEX_FILE}`);
    return true;
}

// 生成 JavaScript 代码来加载脚本信息
function generateLoadScriptInfo(scripts) {
    const lines = ['        async function loadScriptInfo() {'];

    for (const script of scripts) {
        const idSuffix = script.dirName.replace(/-/g, '');
        const userJsPath = `${script.dirName}/user.js`;

        lines.push(`            const ${idSuffix}Info = await getFileInfo('${userJsPath}');`);
        lines.push(`            document.getElementById('${idSuffix}-time').textContent = ${idSuffix}Info.lastModified;`);
        lines.push(`            document.getElementById('${idSuffix}-size').textContent = ${idSuffix}Info.size;`);
        lines.push('');
    }

    lines.push('        }');

    return lines.join('\n');
}

// 更新 index.html 中的 loadScriptInfo 函数
function updateLoadScriptInfoFunction(scripts) {
    if (!fs.existsSync(INDEX_FILE)) {
        console.error('script/index.html 不存在');
        return false;
    }

    let content = fs.readFileSync(INDEX_FILE, 'utf-8');

    // 生成新的函数代码
    const newFunction = generateLoadScriptInfo(scripts);

    // 查找并替换 loadScriptInfo 函数
    const functionStartRegex = /\/\/ 加载脚本信息\s*\n\s*async function loadScriptInfo\(\) \{/;
    const functionEndRegex = /\n\s*\/\/ 页面加载完成后获取文件信息/;

    const functionStartMatch = content.match(functionStartRegex);
    if (!functionStartMatch) {
        console.warn('未找到 loadScriptInfo 函数，跳过更新');
        return false;
    }

    const functionStartIndex = functionStartMatch.index + functionStartMatch[0].length;
    const functionEndMatch = content.substring(functionStartIndex).match(functionEndRegex);

    if (!functionEndMatch) {
        console.error('无法找到 loadScriptInfo 函数结束标记');
        return false;
    }

    const functionEndIndex = functionStartIndex + functionEndMatch.index;

    const newContent =
        content.substring(0, functionStartMatch.index) +
        '// 加载脚本信息\n        ' +
        newFunction +
        content.substring(functionEndIndex);

    fs.writeFileSync(INDEX_FILE, newContent, 'utf-8');
    console.log('✅ 已更新 loadScriptInfo 函数');
    return true;
}

// 主函数
function main() {
    console.log('🔍 扫描脚本目录...');
    const scripts = scanScriptDirectory();

    if (scripts.length === 0) {
        console.log('⚠️  未找到任何脚本');
        return;
    }

    console.log(`✅ 找到 ${scripts.length} 个脚本:`);
    scripts.forEach(script => {
        const icon = script.hasIndex ? '📄' : '📥';
        console.log(`   ${icon} ${script.name} (${script.dirName})`);
    });

    console.log('\n📝 更新 script/index.html...');
    updateIndexHtml(scripts);
    updateLoadScriptInfoFunction(scripts);

    console.log('\n✨ 完成！');
}

main();
