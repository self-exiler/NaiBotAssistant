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
    
    // 禁用所有按钮
    document.querySelectorAll('.btn').forEach(btn => {
        btn.disabled = loading;
        btn.classList.toggle(UI.CLASSES.LOADING, loading);
    });
    
    // 禁用所有输入框
    document.querySelectorAll('input').forEach(input => {
        input.disabled = loading;
    });
}

// 读取扁平化数据
async function loadData() {
    try {
        setLoading(true);
        const response = await fetch('/api/data');
        
        if (!response.ok) {
            throw new Error(response.statusText || UI.MESSAGES.NETWORK_ERROR);
        }
        
        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.msg || UI.MESSAGES.LOAD_ERROR);
        }
        
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
    
    if (!tableHead || !tableBody) {
        console.error('Table elements not found');
        return;
    }
    
    // 清空现有内容
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
    
    // 创建表头
    const headerRow = document.createElement('tr');
    
    // 添加数据列
    state.columns.forEach(col => {
        const th = document.createElement('th');
        th.style.width = state.columnWidths[col];
        th.textContent = getColumnLabel(col);
        headerRow.appendChild(th);
    });
    
    // 添加操作列
    const actionsTh = document.createElement('th');
    actionsTh.style.width = state.columnWidths.actions;
    actionsTh.textContent = '操作';
    headerRow.appendChild(actionsTh);
    
    tableHead.appendChild(headerRow);
    
    // 创建表体
    const fragment = document.createDocumentFragment();
    
    state.data.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        tr.dataset.index = rowIndex;
        
        // 添加数据单元格
        state.columns.forEach(col => {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.value = row[col] || '';
            input.title = row[col] || '';
            input.setAttribute('aria-label', `${getColumnLabel(col)} - 行 ${rowIndex + 1}`);
            input.addEventListener('change', e => updateCell(rowIndex, col, e.target.value));
            input.addEventListener('input', e => e.target.title = e.target.value);
            td.appendChild(input);
            tr.appendChild(td);
        });
        
        // 添加操作单元格
        const actionsTd = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = '删除';
        deleteBtn.title = '删除此行';
        deleteBtn.setAttribute('aria-label', `删除行 ${rowIndex + 1}`);
        deleteBtn.onclick = () => deleteRow(rowIndex);
        actionsTd.appendChild(deleteBtn);
        tr.appendChild(actionsTd);
        
        fragment.appendChild(tr);
    });
    
    tableBody.appendChild(fragment);
}

// 获取列标签
function getColumnLabel(column) {
    const labels = {
        category: '分类',
        term: '词条',
        trans: '译文',
        note: '备注'
    };
    return labels[column] || column;
}

// 更新单元格
function updateCell(row, col, value) {
    try {
        // 数据验证
        if (col === 'category' && value.length > 20) {
            showMessage('分类名称不能超过20个字符', 'error');
            renderTable(); // 重新渲染以恢复原值
            return;
        }
        if (col === 'term' && value.length > 50) {
            showMessage('词条不能超过50个字符', 'error');
            renderTable();
            return;
        }
        if (col === 'trans' && value.length > 100) {
            showMessage('译文不能超过100个字符', 'error');
            renderTable();
            return;
        }
        if (col === 'note' && value.length > 200) {
            showMessage('备注不能超过200个字符', 'error');
            renderTable();
            return;
        }

        state.data[row][col] = value.trim();
    } catch (error) {
        console.error('Error updating cell:', error);
        showMessage('更新失败，请重试', 'error');
    }
}

// 删除行
function deleteRow(row) {
    if (confirm(UI.MESSAGES.CONFIRM_DELETE)) {
        try {
            state.data.splice(row, 1);
            
            // 如果删除了最后一行，添加一个空行
            if (state.data.length === 0) {
                state.data.push({category: '', term: '', trans: '', note: ''});
            }
            
            renderTable();
            showMessage('已删除该行', 'success');
        } catch (error) {
            console.error('Error deleting row:', error);
            showMessage('删除失败，请重试', 'error');
        }
    }
}

// 添加新行
function addRow() {
    try {
        const newRow = {};
        state.columns.forEach(col => newRow[col] = '');
        state.data.push(newRow);
        renderTable();
        
        // 滚动到底部
        const tableBody = document.getElementById('tableBody');
        if (tableBody) {
            tableBody.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    } catch (error) {
        console.error('Error adding row:', error);
        showMessage('添加新行失败，请重试', 'error');
    }
}

// 转换扁平数组为嵌套结构
function convertToNested(data) {
    const nested = {};
    
    data.forEach(item => {
        const category = item.category.trim();
        const term = item.term.trim();
        const trans = item.trans.trim();
        
        // 跳过空行
        if (!category || !term || !trans) return;
        
        if (!nested[category]) {
            nested[category] = [];
        }
        
        nested[category].push({
            term: term,
            trans: trans,
            note: item.note.trim()
        });
    });
    
    return nested;
}

// 保存到服务器
async function saveToServer() {
    if (!confirm(UI.MESSAGES.CONFIRM_SAVE)) return;
    
    try {
        setLoading(true);
        
        // 数据验证
        const invalidEntry = state.data.find(item => 
            (item.category && item.category.length > 20) ||
            (item.term && item.term.length > 50) ||
            (item.trans && item.trans.length > 100) ||
            (item.note && item.note.length > 200)
        );
        
        if (invalidEntry) {
            throw new Error('存在超出长度限制的数据，请检查后重试');
        }
        
        const nestedData = convertToNested(state.data);
        
        const response = await fetch('/api/data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(nestedData)
        });
        
        if (!response.ok) {
            throw new Error(response.statusText || UI.MESSAGES.NETWORK_ERROR);
        }
        
        const result = await response.json();
        
        if (result.status === 'ok') {
            showMessage(UI.MESSAGES.SAVE_SUCCESS, 'success');
            await loadData(); // 重新加载数据确保一致性
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
    try {
        // 事件绑定
        document.getElementById('saveToServer')?.addEventListener('click', saveToServer);
        document.getElementById('saveToServerTop')?.addEventListener('click', saveToServer);
        document.getElementById('addRow')?.addEventListener('click', addRow);
        
        // 键盘快捷键支持
        document.addEventListener('keydown', function(e) {
            // Ctrl/Cmd + S = 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveToServer();
            }
            // Ctrl/Cmd + Enter = 新增行
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                addRow();
            }
        });
        
        // 防止意外关闭
        window.addEventListener('beforeunload', function(e) {
            if (state.isLoading) {
                e.preventDefault();
                e.returnValue = '数据正在保存，确定要离开吗？';
                return e.returnValue;
            }
        });
        
        // 初始加载数据
        loadData();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showMessage('页面初始化失败，请刷新重试', 'error');
    }
});