// 状态管理
const state = {
    data: [],
    columns: ['category', 'term', 'trans', 'note'],
    isLoading: false,
    columnWidths: {
        category: '15%',
        term: '25%',
        trans: '25%',
        note: '30%',
        actions: '5%'
    }
};

// UI相关常量
const UI = {
    MESSAGES: {
        LOAD_ERROR: '加载数据失败',
        SAVE_ERROR: '保存失败',
        SAVE_SUCCESS: '保存成功',
        CONFIRM_SAVE: '确定要保存所有更改吗？',
        CONFIRM_DELETE: '确定要删除这一行吗？',
        NETWORK_ERROR: '网络连接错误'
    },
    CLASSES: {
        LOADING: 'loading',
        ERROR: 'error',
        SUCCESS: 'success'
    }
};

// 显示状态消息
function showMessage(message, type = 'info') {
    const msgElement = document.getElementById('msg');
    if (!msgElement) return;

    msgElement.textContent = message;
    msgElement.className = type;
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            msgElement.textContent = '';
            msgElement.className = '';
        }, 3000);
    }
}

// 显示加载状态
function setLoading(loading) {
    state.isLoading = loading;
    document.querySelectorAll('.btn, input').forEach(el => el.disabled = loading);
    document.querySelectorAll('.btn').forEach(btn => btn.classList.toggle(UI.CLASSES.LOADING, loading));
}

// 读取扁平化数据
async function loadData() {
    try {
        setLoading(true);
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error(response.statusText || UI.MESSAGES.NETWORK_ERROR);
        
        const data = await response.json();
        if (data.status === 'error') throw new Error(data.msg || UI.MESSAGES.LOAD_ERROR);
        
        state.data = Array.isArray(data) ? data : [];
        if (!state.data.length) {
            state.data = [{category: '', term: '', trans: '', note: ''}];
        }
        renderTable();
    } catch (error) {
        console.error('Error loading data:', error);
        showMessage(UI.MESSAGES.LOAD_ERROR + ': ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// 渲染表格
function renderTable() {
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    if (!tableHead || !tableBody) return;

    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    const headerRow = document.createElement('tr');
    state.columns.forEach(col => {
        const th = document.createElement('th');
        th.style.width = state.columnWidths[col];
        th.textContent = getColumnLabel(col);
        headerRow.appendChild(th);
    });
    const actionsTh = document.createElement('th');
    actionsTh.style.width = state.columnWidths.actions;
    actionsTh.textContent = '操作';
    headerRow.appendChild(actionsTh);
    tableHead.appendChild(headerRow);

    const fragment = document.createDocumentFragment();
    state.data.forEach((row, rowIndex) => {
        // 直接使用 createRowElement 函数创建行，代码更清晰
        fragment.appendChild(createRowElement(row, rowIndex));
    });
    tableBody.appendChild(fragment);
}

// --- 优化点 2: 封装创建 DOM 元素 ---
// 将创建单行 tr 的逻辑封装成一个独立的函数，方便在 addRow 中直接调用
function createRowElement(row, rowIndex) {
    const tr = document.createElement('tr');
    tr.dataset.index = rowIndex;

    state.columns.forEach(col => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = row[col] || '';
        input.title = row[col] || '';
        input.dataset.col = col; // 使用 data-* 属性来标识列
        input.setAttribute('aria-label', `${getColumnLabel(col)} - 行 ${rowIndex + 1}`);
        td.appendChild(input);
        tr.appendChild(td);
    });

    const actionsTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '删除';
    deleteBtn.title = '删除此行';
    deleteBtn.setAttribute('aria-label', `删除行 ${rowIndex + 1}`);
    deleteBtn.dataset.action = 'delete'; // 使用 data-* 属性标识操作
    actionsTd.appendChild(deleteBtn);
    tr.appendChild(actionsTd);

    return tr;
}


// 获取列标签
function getColumnLabel(column) {
    const labels = { category: '分类', term: '词条', trans: '译文', note: '备注' };
    return labels[column] || column;
}

// 更新单元格数据
function updateCell(rowIndex, col, value) {
    // 简单的长度验证
    const maxLengths = { category: 20, term: 50, trans: 100, note: 200 };
    if (maxLengths[col] && value.length > maxLengths[col]) {
        showMessage(`${getColumnLabel(col)}不能超过${maxLengths[col]}个字符`, 'error');
        // 找到对应的 input 元素并恢复原值
        const input = document.querySelector(`tr[data-index='${rowIndex}'] input[data-col='${col}']`);
        if(input) input.value = state.data[rowIndex][col];
        return;
    }
    state.data[rowIndex][col] = value.trim();
}

// --- 优化点 3: 直接操作 DOM 进行删除 ---
// 删除行，不再重绘整个表格，而是直接删除对应的 tr 元素
function deleteRow(rowIndex) {
    if (confirm(UI.MESSAGES.CONFIRM_DELETE)) {
        state.data.splice(rowIndex, 1);
        
        const tableBody = document.getElementById('tableBody');
        const rowElement = tableBody.querySelector(`tr[data-index='${rowIndex}']`);
        if (rowElement) {
            rowElement.remove();
        }
        
        // 更新后续所有行的 data-index 属性，确保索引正确
        tableBody.querySelectorAll('tr').forEach((tr, newIndex) => {
            tr.dataset.index = newIndex;
        });

        if (state.data.length === 0) {
            addRow(); // 如果删完了，就新增一个空行
        }
        showMessage('已删除该行', 'success');
    }
}

// --- 优化点 4: 直接操作 DOM 进行添加 ---
// 添加新行，不再重绘整个表格，而是直接在末尾追加一个新的 tr 元素
function addRow() {
    const newRowData = {category: '', term: '', trans: '', note: ''};
    state.data.push(newRowData);
    
    const tableBody = document.getElementById('tableBody');
    const newIndex = state.data.length - 1;
    const newRowElement = createRowElement(newRowData, newIndex);
    tableBody.appendChild(newRowElement);
    
    // 滚动到底部并聚焦第一个输入框
    newRowElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    newRowElement.querySelector('input').focus();
}

// 转换扁平数组为嵌套结构
function convertToNested(data) {
    return data.reduce((nested, item) => {
        const { category, term, trans, note } = item;
        const cat = category.trim();
        const t = term.trim();
        if (!cat || !t) return nested; // 跳过不完整的行
        
        if (!nested[cat]) nested[cat] = [];
        nested[cat].push({ term: t, trans: trans.trim(), note: note.trim() });
        return nested;
    }, {});
}

// 保存到服务器
async function saveToServer() {
    if (!confirm(UI.MESSAGES.CONFIRM_SAVE)) return;
    
    try {
        setLoading(true);
        const nestedData = convertToNested(state.data);
        
        const response = await fetch('/api/data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(nestedData)
        });
        
        if (!response.ok) throw new Error(response.statusText || UI.MESSAGES.NETWORK_ERROR);
        const result = await response.json();
        
        if (result.status === 'ok') {
            showMessage(UI.MESSAGES.SAVE_SUCCESS, 'success');
            await loadData();
        } else {
            throw new Error(result.msg || UI.MESSAGES.SAVE_ERROR);
        }
    } catch (error) {
        console.error('Error saving data:', error);
        showMessage(error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// 初始化
window.addEventListener('DOMContentLoaded', function() {
    // 事件绑定
    document.getElementById('saveToServer')?.addEventListener('click', saveToServer);
    document.getElementById('saveToServerTop')?.addEventListener('click', saveToServer);
    document.getElementById('addRow')?.addEventListener('click', addRow);
    
    // --- 优化点 1: 事件委托 (Event Delegation) ---
    // 将事件监听器绑定在父元素 tableBody 上，而不是每个 input 和 button
    const tableBody = document.getElementById('tableBody');
    
    // 监听 input 的 change 事件
    tableBody.addEventListener('change', function(e) {
        if (e.target.tagName === 'INPUT') {
            const tr = e.target.closest('tr');
            if (!tr) return;
            const rowIndex = parseInt(tr.dataset.index, 10);
            const col = e.target.dataset.col;
            updateCell(rowIndex, col, e.target.value);
        }
    });

    // 监听 button 的 click 事件
    tableBody.addEventListener('click', function(e) {
        if (e.target.dataset.action === 'delete') {
            const tr = e.target.closest('tr');
            if (!tr) return;
            const rowIndex = parseInt(tr.dataset.index, 10);
            deleteRow(rowIndex);
        }
    });

    // 键盘快捷键支持 (保持不变)
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveToServer();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            addRow();
        }
    });
    
    // 防止意外关闭 (保持不变)
    window.addEventListener('beforeunload', function(e) {
        if (state.isLoading) {
            e.preventDefault();
            e.returnValue = '数据正在保存，确定要离开吗？';
        }
    });
    
    // 初始加载数据
    loadData();
});