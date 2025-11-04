// 创建一个全局命名空间，避免污染全局作用域
window.app = {
    ui: {},
    utils: {},
    api: {}
};

/**
 * UI相关函数
 */

/**
 * 显示状态消息，并在3秒后自动消失
 * @param {string} elementId - 要显示消息的元素的ID
 * @param {string} message - 要显示的消息内容
 * @param {string} type - 消息类型 ('info', 'success', 'warning', 'error')
 */
app.ui.showMessage = function(elementId, message, type = 'info') {
    const msgElement = document.getElementById(elementId);
    if (!msgElement) return;

    // 清除之前的定时器，防止消息过早消失
    clearTimeout(msgElement.timeoutId);

    msgElement.textContent = message;
    // 根据类型设置样式
    msgElement.className = `${type}`; // 直接使用类型作为class
    
    // 如果是错误或警告，添加抖动动画以示提醒
    if (type === 'error' || type === 'warning') {
        msgElement.classList.add('shake-message');
        msgElement.addEventListener('animationend', () => {
            msgElement.classList.remove('shake-message');
        }, { once: true });
    }

    // 非 'info' 消息（如 success/error/warning）3秒后自动清除
    // 'info' 消息（如“加载中”）应由调用者手动清除
    if (type !== 'info') {
        msgElement.timeoutId = setTimeout(() => {
            msgElement.textContent = '';
            msgElement.className = '';
        }, 3000);
    }
};

/**
 * 设置元素的加载状态
 * @param {boolean} loading - 是否处于加载状态
 * @param {string} selector - 要禁用/启用并显示加载动画的按钮选择器
 */
app.ui.setLoading = function(loading, selector = '.btn') {
    document.querySelectorAll(selector).forEach(el => {
        el.disabled = loading;
        el.classList.toggle('loading', loading);
    });
};


/**
 * [修改] 填充分类 <select> 下拉列表
 * (移除内部的 try...catch, 让调用者处理错误)
 * @param {string} elementId - <select> 元素的ID
 * @param {string} defaultOptionText - 默认选项的提示文字 (例如 "——请选择——")
 * @returns {Promise<void>}
 */
app.ui.populateCategorySelect = async function(elementId, defaultOptionText = "——请选择——") {
    const select = document.getElementById(elementId);
    if (!select) return;

    const currentVal = select.value; // 1. 记住当前选中的值
    select.disabled = true;
    select.innerHTML = ''; // 2. 清空所有选项

    const fragment = document.createDocumentFragment();
    
    // 3. 添加默认选项
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = defaultOptionText;
    fragment.appendChild(defaultOption);

    try {
        // 4. 获取并添加排序后的分类
        // (如果 fetchSortedCategories 失败, 错误将抛出)
        const categories = await app.api.fetchSortedCategories();
        
        categories.forEach(cat => {
             const option = document.createElement('option');
             option.value = cat;
             option.textContent = cat;
             fragment.appendChild(option);
        });
        
        select.appendChild(fragment);
        select.value = currentVal; // 5. 恢复选中的值 (如果还在列表中的话)
        
    } finally {
        // 无论成功与否，都要启用 select
        select.disabled = false;
    }
};

/**
 * [修改] 填充分类 <datalist>
 * (移除内部的 try...catch, 让调用者处理错误)
 * @param {string} elementId - <datalist> 元素的ID
 * @returns {Promise<void>}
 */
app.ui.populateCategoryDatalist = async function(elementId) {
    const datalist = document.getElementById(elementId);
    if (!datalist) return;

    // (如果 fetchSortedCategories 失败, 错误将抛出)
    const categories = await app.api.fetchSortedCategories();
    const fragment = document.createDocumentFragment();
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        fragment.appendChild(option);
    });
    
    datalist.innerHTML = ''; // 先清空旧的列表
    datalist.appendChild(fragment);
};


/**
 * 工具函数
 */

/**
 * 防抖函数：在事件触发后的一段时间内，如果事件没有再次触发，则执行函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 延迟时间 (毫秒)
 * @returns {Function} - 包装后的函数
 */
app.utils.debounce = function(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

/**
 * [新增] 健壮的复制函数 (从 promptOutput.js 移入)
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} - 是否复制成功
 */
app.utils.copyToClipboard = async function(text) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error("Clipboard API 失败，尝试后备方法:", error);
        }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
    } catch (err) {
        console.error('后备的 execCommand 方法失败:', err);
        document.body.removeChild(textarea);
        return false;
    }
};


/**
 * API 相关函数
 */

/**
 * 封装的 fetch API, 用于处理网络请求和基本错误
 * @param {string} url - 请求的URL
 * @param {object} options - fetch 的配置选项 (method, headers, body等)
 * @returns {Promise<any>} - 解析后的 JSON 数据
 */
app.api.fetchAPI = async function(url, options = {}) {
    const response = await fetch(url, options);
    
    // 尝试解析JSON，即使响应失败也可能
    let result;
    try {
        result = await response.json();
    } catch(e) {
        // 如果响应体为空或不是JSON
        result = { msg: response.statusText || '响应体无效' };
    }

    if (!response.ok) {
        throw new Error(result.msg || `网络请求失败: ${response.status}`);
    }
    
    return result;
};

/**
 * [新增] 获取并按拼音排序分类列表
 * [修改] 移除冗余的客户端排序，后端已保证顺序
 * @returns {Promise<string[]>} - 排序后的分类数组
 */
app.api.fetchSortedCategories = async function() {
    try {
        const categories = await app.api.fetchAPI('/api/categories');
        // 移除: categories.sort(new Intl.Collator('zh-CN-u-co-pinyin').compare);
        // 后端已保证排序
        return categories;
    } catch (error) {
        console.error('获取分类出错:', error);
        // 向上抛出，让调用者处理UI提示
        throw new Error('加载分类失败: ' + (error.message || '未知错误'));
    }
};