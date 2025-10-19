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
    
    // 3秒后自动清除消息
    msgElement.timeoutId = setTimeout(() => {
        msgElement.textContent = '';
        msgElement.className = '';
    }, 3000);
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
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.msg || '网络请求失败');
    }
    
    return result;
};
