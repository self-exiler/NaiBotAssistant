// 状态管理
const state = {
    selectedTerms: new Set(),
    currentCategory: '',
    searchTerm: '',
    isLoading: false
};

// UI 相关常量
const UI = {
    MESSAGES: {
        LOADING: '加载中...',
        COPY_SUCCESS: '已复制到剪贴板',
        COPY_FAILED: '复制失败，请手动复制',
        FETCH_ERROR: '获取数据失败，请重试',
        NO_CONTENT: '请先选择要复制的内容',
        CATEGORY_LOAD_ERROR: '加载分类失败，请刷新页面重试',
        TERMS_LOAD_ERROR: '加载词条失败，请重试'
    },
    CLASSES: {
        LOADING: 'loading',
        ERROR: 'error',
        SUCCESS: 'success'
    }
};

// 错误处理
class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// 显示加载状态
function showLoading(element, isLoading = true) {
    if (isLoading) {
        element.classList.add(UI.CLASSES.LOADING);
        element.disabled = true;
    } else {
        element.classList.remove(UI.CLASSES.LOADING);
        element.disabled = false;
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// API 请求函数
async function fetchCategories() {
    try {
        const response = await fetch('/api/categories');
        const data = await response.json();
        
        if (!response.ok) {
            throw new ApiError(data.msg || UI.MESSAGES.FETCH_ERROR, response.status);
        }
        
        if (Array.isArray(data)) {
            return data;
        } else if (data.status === 'error') {
            throw new ApiError(data.msg || UI.MESSAGES.FETCH_ERROR);
        }
        
        throw new ApiError(UI.MESSAGES.FETCH_ERROR);
    } catch (error) {
        console.error('获取分类出错:', error);
        throw error;
    }
}

async function fetchTerms(category) {
    if (!category) {
        throw new ApiError('请选择分类');
    }
    
    try {
        const response = await fetch(`/api/terms/${encodeURIComponent(category)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new ApiError(data.msg || UI.MESSAGES.FETCH_ERROR, response.status);
        }
        
        if (Array.isArray(data)) {
            return data;
        } else if (data.status === 'error') {
            throw new ApiError(data.msg || UI.MESSAGES.FETCH_ERROR);
        }
        
        throw new ApiError(UI.MESSAGES.FETCH_ERROR);
    } catch (error) {
        console.error('获取词条出错:', error);
        throw error;
    }
}

// 初始化分类选择器
async function initCategorySelect() {
    const select = document.getElementById('categorySelect');
    showLoading(select, true);
    
    try {
        const categories = await fetchCategories();
        
        if (categories.length === 0) {
            showNotification('暂无可用分类', 'info');
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        // 添加默认选项
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '请选择分类';
        fragment.appendChild(defaultOption);
        
        // 添加分类选项
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            fragment.appendChild(option);
        });
        
        select.innerHTML = '';
        select.appendChild(fragment);
        
    } catch (error) {
        console.error('初始化分类选择器失败:', error);
        showNotification(UI.MESSAGES.CATEGORY_LOAD_ERROR, 'error');
    } finally {
        showLoading(select, false);
    }
}

// 搜索过滤处理
const handleSearch = debounce(function(searchTerm) {
    state.searchTerm = searchTerm.toLowerCase().trim();
    const termList = document.getElementById('termList');
    const termItems = termList.querySelectorAll('label');
    let visibleCount = 0;
    
    termItems.forEach(item => {
        const termText = item.textContent.toLowerCase();
        const isVisible = termText.includes(state.searchTerm);
        
        // 使用 CSS 类来控制可见性
        item.classList.toggle('hidden', !isVisible);
        
        // 处理换行符的可见性
        const nextBr = item.nextElementSibling;
        if (nextBr?.tagName === 'BR') {
            nextBr.classList.toggle('hidden', !isVisible);
        }
        
        if (isVisible) visibleCount++;
    });
    
    // 显示搜索结果数量
    if (state.searchTerm) {
        const message = visibleCount > 0 
            ? `找到 ${visibleCount} 个匹配项` 
            : '未找到匹配项';
        showNotification(message, visibleCount > 0 ? 'info' : 'warning');
    }
}, 300);
// ---------- 渲染复选框 ----------
function renderTerms(terms) {
    const container = document.getElementById('termList');
    container.innerHTML = '';
    
    if (!Array.isArray(terms) || terms.length === 0) {
        container.innerHTML = '<p class="no-data">该分类下暂无词条</p>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    terms.forEach(term => {
        if (!term || typeof term !== 'object') return;
        
        const { term: text, trans, note } = term;
        
        const label = document.createElement('label');
        label.className = 'term-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'term-checkbox';
        checkbox.dataset.trans = trans;
        checkbox.dataset.term = text;
        checkbox.checked = state.selectedTerms.has(trans);
        checkbox.addEventListener('change', handleTermSelection);
        
        const span = document.createElement('span');
        span.className = 'term-text';
        span.textContent = text;
        
        label.appendChild(checkbox);
        label.appendChild(span);
        
        if (note && note.trim()) {
            const noteSpan = document.createElement('span');
            noteSpan.className = 'term-note';
            noteSpan.textContent = `（${note.trim()}）`;
            label.appendChild(noteSpan);
        }
        
        fragment.appendChild(label);
        fragment.appendChild(document.createElement('br'));
    });
    
    container.appendChild(fragment);
    
    // 如果有搜索词，立即应用过滤
    if (state.searchTerm) {
        handleSearch(state.searchTerm);
    }
}

// ---------- 处理词条选择 ----------
function handleTermSelection(event) {
    const checkbox = event.target;
    const trans = checkbox.dataset.trans;
    const term = checkbox.dataset.term;
    
    if (checkbox.checked) {
        state.selectedTerms.add(trans);
        showNotification(`已添加：${term}`, 'success');
    } else {
        state.selectedTerms.delete(trans);
        showNotification(`已移除：${term}`, 'info');
    }
    
    updateOutputText();
}

// ---------- 更新输出文本 ----------
function updateOutputText() {
    const outputArea = document.getElementById('outputArea');
    const selectedTerms = [...state.selectedTerms];
    outputArea.value = selectedTerms.join(', ');
    
    // 更新选中数量显示
    const count = selectedTerms.length;
    document.getElementById('selectedCount').textContent = `已选择 ${count} 个词条`;
}
// ---------- 清除选中 ----------
document.getElementById('clearBtn').addEventListener('click', function() {
    if (state.selectedTerms.size === 0) {
        showNotification('当前没有选中的词条', 'info');
        return;
    }
    
    const confirmed = confirm(`确定要清除所有已选中的词条吗？（共 ${state.selectedTerms.size} 个）`);
    if (!confirmed) return;
    
    state.selectedTerms.clear();
    
    // 清除所有复选框选中状态
    const checkboxes = document.querySelectorAll('#termList input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    
    updateOutputText();
    showNotification('已清除所有选中项', 'success');
});

// ---------- 复制 ----------
document.getElementById('copyBtn').addEventListener('click', async function() {
    const outputArea = document.getElementById('outputArea');
    const text = outputArea.value.trim();
    
    if (!text) {
        showNotification(UI.MESSAGES.NO_CONTENT, 'warning');
        return;
    }
    
    // 检查是否需要添加 nai 前缀
    const useNaiPrefix = document.getElementById('naiPrefix').checked;
    const finalText = useNaiPrefix ? 'nai ' + text : text;
    
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(finalText);
            showNotification(UI.MESSAGES.COPY_SUCCESS, 'success');
            
            // 复制成功后的视觉反馈
            outputArea.classList.add('copy-success');
            setTimeout(() => outputArea.classList.remove('copy-success'), 1000);
            
        } else {
            // 回退方案
            const textarea = document.createElement('textarea');
            textarea.value = finalText;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (success) {
                showNotification(UI.MESSAGES.COPY_SUCCESS, 'success');
            } else {
                throw new Error('复制失败');
            }
        }
    } catch (error) {
        console.error('复制失败:', error);
        showNotification(UI.MESSAGES.COPY_FAILED, 'error');
        
        // 在复制失败时，自动选中文本框内容以便用户手动复制
        outputArea.select();
    }
});

// ---------- 初始化 ----------
// 监听分类选择变化
document.getElementById('categorySelect').addEventListener('change', async function(event) {
    const category = event.target.value;
    if (!category) {
        document.getElementById('termList').innerHTML = '<p class="no-data">请选择一个分类</p>';
        return;
    }
    
    try {
        showLoading(event.target, true);
        const terms = await fetchTerms(category);
        renderTerms(terms);
    } catch (error) {
        console.error('加载词条失败:', error);
        showNotification(UI.MESSAGES.TERMS_LOAD_ERROR, 'error');
    } finally {
        showLoading(event.target, false);
    }
});

// 监听搜索输入
document.getElementById('searchInput').addEventListener('input', function(event) {
    handleSearch(event.target.value);
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initCategorySelect();
});