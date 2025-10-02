// 状态管理
const state = {
    selectedTerms: new Set(),
    currentCategory: '',
    searchTerm: '',
    isLoading: false,
    // --- 优化点 2: 客户端缓存 ---
    // 创建一个缓存对象来存储已获取的分类词条
    termsCache: {}
};

// UI 相关常量
const UI = {
    MESSAGES: {
        COPY_SUCCESS: '已复制到剪贴板',
        COPY_FAILED: '复制失败，请手动复制',
        FETCH_ERROR: '获取数据失败，请重试',
        NO_CONTENT: '请先选择要复制的内容',
        CATEGORY_LOAD_ERROR: '加载分类失败',
        TERMS_LOAD_ERROR: '加载词条失败'
    }
};

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
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
    }, 2000);
}

// API 请求函数
async function fetchAPI(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ msg: UI.MESSAGES.FETCH_ERROR }));
        throw new Error(errorData.msg || response.statusText);
    }
    return response.json();
}

async function fetchCategories() {
    try {
        return await fetchAPI('/api/categories');
    } catch (error) {
        console.error('获取分类出错:', error);
        showNotification(UI.MESSAGES.CATEGORY_LOAD_ERROR, 'error');
        return [];
    }
}

async function fetchTerms(category) {
    // --- 优化点 2: 使用缓存 ---
    // 在请求前，先检查缓存中是否已有该分类的数据
    if (state.termsCache[category]) {
        return state.termsCache[category];
    }

    try {
        const terms = await fetchAPI(`/api/terms/${encodeURIComponent(category)}`);
        // 请求成功后，将数据存入缓存
        state.termsCache[category] = terms;
        return terms;
    } catch (error) {
        console.error('获取词条出错:', error);
        showNotification(UI.MESSAGES.TERMS_LOAD_ERROR, 'error');
        return [];
    }
}

// 初始化分类选择器
async function initCategorySelect() {
    const select = document.getElementById('categorySelect');
    select.disabled = true;
    
    const categories = await fetchCategories();
    if (categories.length > 0) {
        const fragment = document.createDocumentFragment();
        const defaultOption = new Option('请选择分类', '');
        fragment.appendChild(defaultOption);
        categories.forEach(category => fragment.appendChild(new Option(category, category)));
        select.innerHTML = '';
        select.appendChild(fragment);
    } else {
        showNotification('暂无可用分类', 'info');
    }
    
    select.disabled = false;
}

// 搜索过滤处理
const handleSearch = debounce(function(searchTerm) {
    state.searchTerm = searchTerm.toLowerCase().trim();
    const termList = document.getElementById('termList');
    const termItems = termList.querySelectorAll('label.term-item');
    
    termItems.forEach(item => {
        const isVisible = item.textContent.toLowerCase().includes(state.searchTerm);
        item.classList.toggle('hidden', !isVisible);
    });
}, 300);

// 渲染复选框
function renderTerms(terms) {
    const container = document.getElementById('termList');
    container.innerHTML = '';
    
    if (!terms || terms.length === 0) {
        container.innerHTML = '<p class="no-data">该分类下暂无词条</p>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    terms.forEach(({ term, trans, note }) => {
        const label = document.createElement('label');
        label.className = 'term-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'term-checkbox';
        checkbox.value = trans; // 使用 value 存储 trans
        checkbox.dataset.term = term;
        checkbox.checked = state.selectedTerms.has(trans);
        
        const termText = document.createTextNode(` ${term} `);
        
        label.appendChild(checkbox);
        label.appendChild(termText);
        
        if (note && note.trim()) {
            const noteSpan = document.createElement('span');
            noteSpan.className = 'term-note';
            noteSpan.textContent = `(${note.trim()})`;
            label.appendChild(noteSpan);
        }
        
        fragment.appendChild(label);
    });
    
    container.appendChild(fragment);
    if (state.searchTerm) handleSearch(state.searchTerm);
}

// 更新输出文本
function updateOutputText() {
    const outputArea = document.getElementById('outputArea');
    const useNaiPrefix = document.getElementById('naiPrefix').checked;
    const prefix = useNaiPrefix ? 'nai ' : '';
    outputArea.value = prefix + [...state.selectedTerms].join(', ');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initCategorySelect();

    const categorySelect = document.getElementById('categorySelect');
    const termList = document.getElementById('termList');
    
    // 监听分类选择变化
    categorySelect.addEventListener('change', async function(event) {
        const category = event.target.value;
        state.currentCategory = category;
        
        termList.innerHTML = '<p class="no-data">加载中...</p>';
        if (!category) {
            termList.innerHTML = '<p class="no-data">请选择一个分类</p>';
            return;
        }
        
        const terms = await fetchTerms(category);
        renderTerms(terms);
    });

    // --- 优化点 1: 事件委托 ---
    // 将点击事件监听器绑定在父元素 termList 上
    termList.addEventListener('change', function(e) {
        if (e.target.type === 'checkbox') {
            const trans = e.target.value;
            if (e.target.checked) {
                state.selectedTerms.add(trans);
            } else {
                state.selectedTerms.delete(trans);
            }
            updateOutputText();
        }
    });

    // 监听搜索输入
    document.getElementById('searchInput').addEventListener('input', e => handleSearch(e.target.value));
    
    // 监听前缀选项
    document.getElementById('naiPrefix').addEventListener('change', updateOutputText);

    // 清除选中
    document.getElementById('clearBtn').addEventListener('click', function() {
        if (state.selectedTerms.size === 0) return;
        state.selectedTerms.clear();
        document.querySelectorAll('#termList input:checked').forEach(cb => cb.checked = false);
        updateOutputText();
        showNotification('已清除所有选中项', 'success');
    });

    // 复制
    document.getElementById('copyBtn').addEventListener('click', async function() {
        const outputArea = document.getElementById('outputArea');
        const text = outputArea.value.trim();
        if (!text) {
            showNotification(UI.MESSAGES.NO_CONTENT, 'warning');
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            showNotification(UI.MESSAGES.COPY_SUCCESS, 'success');
        } catch (error) {
            showNotification(UI.MESSAGES.COPY_FAILED, 'error');
            outputArea.select(); // 失败时帮助用户手动复制
        }
    });
});