// 状态管理
const state = {
    selectedTerms: new Set(),
    currentCategory: '',
    searchTerm: '',
    isLoading: false,
    termsCache: {}
};

// UI 相关常量
const UI = {
    MESSAGES: {
        COPY_SUCCESS: '已复制到剪贴板',
        COPY_FAILED: '复制失败，请手动复制',
        NO_CONTENT: '请先选择要复制的内容',
        CATEGORY_LOAD_ERROR: '加载分类失败', // [修改] 加回错误消息
        TERMS_LOAD_ERROR: '加载词条失败'
    }
};

async function fetchTerms(category) {
    if (state.termsCache[category]) {
        return state.termsCache[category];
    }
    try {
        const terms = await app.api.fetchAPI(`/api/terms/${encodeURIComponent(category)}`);
        state.termsCache[category] = terms;
        return terms;
    } catch (error) {
        console.error('获取词条出错:', error);
        app.ui.showMessage('promptMessage', UI.MESSAGES.TERMS_LOAD_ERROR, 'error');
        return [];
    }
}

// 搜索过滤处理 (使用公共防抖函数)
const handleSearch = app.utils.debounce(function(searchTerm) {
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
        checkbox.value = trans;
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
    
    // [修改] 增加一个 async init 函数来处理分类加载
    async function initPage() {
        try {
            // 调用公共函数并等待其完成
            await app.ui.populateCategorySelect('categorySelect', '——请选择——');
        } catch (error) {
            // 捕获 common.js 抛出的错误，并显示在 UI 上
            app.ui.showMessage('promptMessage', UI.MESSAGES.CATEGORY_LOAD_ERROR, 'error');
            console.error(error); // 同时在控制台记录详细错误
        }
    }

    initPage(); // 调用 init

    const categorySelect = document.getElementById('categorySelect');
    const termList = document.getElementById('termList');
    
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

    document.getElementById('searchInput').addEventListener('input', e => handleSearch(e.target.value));
    
    document.getElementById('naiPrefix').addEventListener('change', updateOutputText);

    document.getElementById('clearBtn').addEventListener('click', function() {
        if (state.selectedTerms.size === 0) return;
        state.selectedTerms.clear();
        document.querySelectorAll('#termList input:checked').forEach(cb => cb.checked = false);
        updateOutputText();
        app.ui.showMessage('promptMessage', '已清除所有选中项', 'success');
    });

    // [修改] 复制
    document.getElementById('copyBtn').addEventListener('click', async function() {
        const outputArea = document.getElementById('outputArea');
        const textToCopy = outputArea.value.trim();
        
        if (!textToCopy) {
            app.ui.showMessage('promptMessage', UI.MESSAGES.NO_CONTENT, 'warning');
            return;
        }

        // [修改] 使用 common.js 中的函数
        const success = await app.utils.copyToClipboard(textToCopy);

        if (success) {
            app.ui.showMessage('promptMessage', UI.MESSAGES.COPY_SUCCESS, 'success');
        } else {
            app.ui.showMessage('promptMessage', UI.MESSAGES.COPY_FAILED, 'error');
            outputArea.select();
        }
    });
});