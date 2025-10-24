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
        CONFIRM_SORT_SAVE: '确定要按“分类”和“词条”排序所有数据并立即保存吗？此操作不可撤销。'
    }
};

// 读取扁平化数据
async function loadData() {
    try {
        app.ui.setLoading(true);
        const data = await app.api.fetchAPI('/api/data');
        
        state.data = Array.isArray(data) ? data : [];
        if (!state.data.length) {
            state.data = [{category: '', term: '', trans: '', note: ''}];
        }
        renderTable();
    } catch (error) {
        console.error('Error loading data:', error);
        app.ui.showMessage('msg', UI.MESSAGES.LOAD_ERROR + ': ' + error.message, 'error');
    } finally {
        app.ui.setLoading(false);
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
        fragment.appendChild(createRowElement(row, rowIndex));
    });
    tableBody.appendChild(fragment);
}

// 创建行元素
function createRowElement(row, rowIndex) {
    const tr = document.createElement('tr');
    tr.dataset.index = rowIndex;

    state.columns.forEach(col => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = row[col] || '';
        input.title = row[col] || '';
        input.dataset.col = col;
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
    deleteBtn.dataset.action = 'delete';
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
    const maxLengths = { category: 20, term: 50, trans: 100, note: 200 };
    if (maxLengths[col] && value.length > maxLengths[col]) {
        app.ui.showMessage('msg', `${getColumnLabel(col)}不能超过${maxLengths[col]}个字符`, 'error');
        const input = document.querySelector(`tr[data-index='${rowIndex}'] input[data-col='${col}']`);
        if(input) input.value = state.data[rowIndex][col];
        return;
    }
    state.data[rowIndex][col] = value.trim();
}

// 删除行
function deleteRow(rowIndex) {
    if (confirm(UI.MESSAGES.CONFIRM_DELETE)) {
        state.data.splice(rowIndex, 1);
        
        const tableBody = document.getElementById('tableBody');
        const rowElement = tableBody.querySelector(`tr[data-index='${rowIndex}']`);
        if (rowElement) {
            rowElement.remove();
        }
        
        tableBody.querySelectorAll('tr').forEach((tr, newIndex) => {
            tr.dataset.index = newIndex;
        });

        if (state.data.length === 0) {
            addRow();
        }
        app.ui.showMessage('msg', '已删除该行', 'success');
    }
}

// 添加新行
function addRow() {
    const newRowData = {category: '', term: '', trans: '', note: ''};
    state.data.push(newRowData);
    
    const tableBody = document.getElementById('tableBody');
    const newIndex = state.data.length - 1;
    const newRowElement = createRowElement(newRowData, newIndex);
    tableBody.appendChild(newRowElement);
    
    newRowElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    newRowElement.querySelector('input').focus();
}

// 转换扁平数组为嵌套结构
function convertToNested(data) {
    return data.reduce((nested, item) => {
        const { category, term, trans, note } = item;
        const cat = category.trim();
        const t = term.trim();
        if (!cat || !t) return nested;
        
        if (!nested[cat]) nested[cat] = [];
        nested[cat].push({ term: t, trans: trans.trim(), note: note.trim() });
        return nested;
    }, {});
}

/**
 * 新增：排序函数
 * 使用 Intl.Collator (pinyin) 来实现中文拼音排序
 */
function sortData() {
    const collator = new Intl.Collator('zh-CN-u-co-pinyin');
    
    state.data.sort((a, b) => {
        // 1. 按分类排序
        const categoryCompare = collator.compare(a.category, b.category);
        if (categoryCompare !== 0) {
            return categoryCompare;
        }
        // 2. 分类相同，按词条排序
        return collator.compare(a.term, b.term);
    });
}

/**
 * 新增：排序并保存功能
 */
async function sortAndSave() {
    if (!confirm(UI.MESSAGES.CONFIRM_SORT_SAVE)) return;
    
    try {
        // 1. 排序
        sortData();
        
        // 2. 重新渲染表格
        renderTable();
        app.ui.showMessage('msg', '排序完成，正在保存...', 'info');

        // 3. 复用保存逻辑（无二次确认）
        app.ui.setLoading(true);
        const nestedData = convertToNested(state.data);
        
        const result = await app.api.fetchAPI('/api/data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(nestedData)
        });
        
        if (result.status === 'ok') {
            app.ui.showMessage('msg', '排序并保存成功', 'success');
            // 数据已在 state 中同步，无需重载
        } else {
            throw new Error(result.msg || UI.MESSAGES.SAVE_ERROR);
        }
    } catch (error) {
        console.error('Error sorting and saving data:', error);
        app.ui.showMessage('msg', '排序或保存失败，将重新加载数据: ' + error.message, 'error');
        // 如果保存失败，重新从服务器加载原始数据以确保一致性
        await loadData();
    } finally {
        app.ui.setLoading(false);
    }
}


// 保存到服务器
async function saveToServer() {
    if (!confirm(UI.MESSAGES.CONFIRM_SAVE)) return;
    
    try {
        app.ui.setLoading(true);
        const nestedData = convertToNested(state.data);
        
        const result = await app.api.fetchAPI('/api/data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(nestedData)
        });
        
        if (result.status === 'ok') {
            app.ui.showMessage('msg', UI.MESSAGES.SAVE_SUCCESS, 'success');
            await loadData();
        } else {
            throw new Error(result.msg);
        }
    } catch (error) {
        console.error('Error saving data:', error);
        app.ui.showMessage('msg', error.message, 'error');
    } finally {
        app.ui.setLoading(false);
    }
}

// 初始化
window.addEventListener('DOMContentLoaded', function() {
    document.getElementById('saveToServer')?.addEventListener('click', saveToServer);
    document.getElementById('saveToServerTop')?.addEventListener('click', saveToServer);
    document.getElementById('addRow')?.addEventListener('click', addRow);
    // 新增：绑定排序按钮事件
    document.getElementById('sortAndSaveBtn')?.addEventListener('click', sortAndSave);
    
    const tableBody = document.getElementById('tableBody');
    
    tableBody.addEventListener('change', function(e) {
        if (e.target.tagName === 'INPUT') {
            const tr = e.target.closest('tr');
            if (!tr) return;
            const rowIndex = parseInt(tr.dataset.index, 10);
            const col = e.target.dataset.col;
            updateCell(rowIndex, col, e.target.value);
        }
    });

    tableBody.addEventListener('click', function(e) {
        if (e.target.dataset.action === 'delete') {
            const tr = e.target.closest('tr');
            if (!tr) return;
            const rowIndex = parseInt(tr.dataset.index, 10);
            deleteRow(rowIndex);
        }
    });

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
    
    window.addEventListener('beforeunload', function(e) {
        if (state.isLoading) {
            e.preventDefault();
            e.returnValue = '数据正在保存，确定要离开吗？';
        }
    });
    
    loadData();
});