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
        CONFIRM_DELETE: '确定要删除这一行吗？'
        // 其他确认消息将内联定义
    }
};

// 修改 loadData，使其可以按分类加载
async function loadData(category = '') {
    try {
        // 由外层控制 Loading 状态
        
        // 如果没有分类，则不加载数据
        if (!category) {
            state.data = [];
            await renderTable(); // 渲染空表格
            app.ui.showMessage('msg', '请先选择一个分类', 'info');
            return;
        }

        // 按分类请求数据
        const data = await app.api.fetchAPI(`/api/data?category=${encodeURIComponent(category)}`);
        
        state.data = Array.isArray(data) ? data : [];
        if (!state.data.length) {
            // 如果该分类没有数据，也添加一个空行
            state.data = [{category: category, term: '', trans: '', note: ''}];
        }
        
        // 使用方案一的异步 renderTable
        await renderTable(); 

    } catch (error) {
        console.error('Error loading data:', error);
        app.ui.showMessage('msg', UI.MESSAGES.LOAD_ERROR + ': ' + error.message, 'error');
    } finally {
        // 由外层控制 Loading 状态
    }
}

// 替换为异步渲染表格，防止 DOM 阻塞
async function renderTable() {
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    if (!tableHead || !tableBody) return;

    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    // --- 渲染表头 (不变) ---
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

    // --- 异步渲染表体 ---
    const fragment = document.createDocumentFragment();
    const chunkSize = 100; // 每次渲染 100 条

    if (state.data.length === 0) {
        return;
    }
    
    app.ui.showMessage('msg', `正在渲染 ${state.data.length} 条数据...`, 'info');

    for (let i = 0; i < state.data.length; i++) {
        fragment.appendChild(createRowElement(state.data[i], i));

        // 每当达到 chunkSize 或者
        // 已经是最后一条数据时，执行渲染
        if ((i + 1) % chunkSize === 0 || i === state.data.length - 1) {
            tableBody.appendChild(fragment); 
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    app.ui.showMessage('msg', `加载完成，共 ${state.data.length} 条数据`, 'success');
}


// [已修改] 创建行元素
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
        
        // [已移除] 不再设置 'category' 列为只读
        // if (col === 'category') { ... }

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
    if (!state.data[rowIndex]) return; 

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
        
        // 重新索引
        tableBody.querySelectorAll('tr').forEach((tr, newIndex) => {
            tr.dataset.index = newIndex;
            tr.querySelectorAll('input[aria-label]').forEach(input => {
                const colLabel = input.getAttribute('aria-label').split(' - ')[0];
                input.setAttribute('aria-label', `${colLabel} - 行 ${newIndex + 1}`);
            });
            tr.querySelectorAll('button[aria-label]').forEach(btn => {
                btn.setAttribute('aria-label', `删除行 ${newIndex + 1}`);
            });
        });

        if (state.data.length === 0) {
            addRow(); // 如果全删光了，自动加一个新行
        }
        app.ui.showMessage('msg', '已删除该行', 'success');
    }
}

// 修改 addRow，使其自动填充当前分类
function addRow() {
    const currentCategory = document.getElementById('categorySelect')?.value || '';
    if (!currentCategory) {
        app.ui.showMessage('msg', '请先选择一个分类再添加行', 'error');
        return;
    }

    const newRowData = {category: currentCategory, term: '', trans: '', note: ''};
    state.data.push(newRowData);
    
    const tableBody = document.getElementById('tableBody');
    const newIndex = state.data.length - 1;
    const newRowElement = createRowElement(newRowData, newIndex);
    tableBody.appendChild(newRowElement);
    
    newRowElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    const termInput = newRowElement.querySelector('input[data-col="term"]');
    if (termInput) termInput.focus();
}

// 转换扁平数组为嵌套结构
function convertToNested(data) {
    return data.reduce((nested, item) => {
        const { category, term, trans, note } = item;
        const cat = category.trim();
        const t = term.trim();
        
        if (!cat) return nested;
        
        if (!nested[cat]) nested[cat] = [];
        nested[cat].push({ term: t, trans: (trans || '').trim(), note: (note || '').trim() });
        return nested;
    }, {});
}

/**
 * [已修改] 排序并保存功能
 * 现在会先保存，再排序，再刷新
 */
async function sortAndSave() {
    const currentCategory = document.getElementById('categorySelect')?.value;
    if (!currentCategory) {
        app.ui.showMessage('msg', '未选择分类', 'error');
        return;
    }
    
    if (!state.data.length || (state.data.length === 1 && !state.data[0].term)) {
        app.ui.showMessage('msg', '没有可排序的数据', 'warning');
        return;
    }
    
    if (!confirm(`确定要对分类 "${currentCategory}" 按“词条”拼音排序吗？\n\n(注意：排序前会先保存您在表格中的所有更改，包括跨分类移动。)`)) {
         return;
    }
    
    try {
        app.ui.setLoading(true);

        // 步骤 1: 保存所有 pending 的更改
        app.ui.showMessage('msg', '步骤 1/3: 正在保存更改...', 'info');
        const nestedData = convertToNested(state.data);
        const saveResult = await app.api.fetchAPI('/api/data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(nestedData)
        });
        if (saveResult.status !== 'ok') {
            throw new Error('保存更改失败: ' + (saveResult.msg || '未知错误'));
        }

        // 步骤 2: 调用后端排序 API
        app.ui.showMessage('msg', '步骤 2/3: 正在请求排序...', 'info');
        const sortResult = await app.api.fetchAPI('/api/sort', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ category: currentCategory })
        });
        if (sortResult.status !== 'ok') {
            throw new Error('排序失败: ' + (sortResult.msg || '未知错误'));
        }
        
        // 步骤 3: 刷新分类列表和当前分类数据
        app.ui.showMessage('msg', '步骤 3/3: 正在刷新数据...', 'info');
        await loadCategories(); // 刷新分类列表
        await loadData(currentCategory); // 刷新当前表格
        
        app.ui.showMessage('msg', '排序并保存成功', 'success');

    } catch (error) {
        console.error('Error sorting and saving data:', error);
        app.ui.showMessage('msg', `操作失败: ${error.message}`, 'error');
    } finally {
        app.ui.setLoading(false);
    }
}


// [已修改] 保存到服务器
async function saveToServer() {
    const currentCategory = document.getElementById('categorySelect')?.value;
    if (!currentCategory) {
        app.ui.showMessage('msg', '未选择分类 (无法确定上下文)', 'error');
        return;
    }

    if (!confirm(`确定要保存当前表格中的所有更改吗？\n\n(这会更新表格中涉及的所有分类，并允许跨分类移动。)`)) {
         app.ui.showMessage('msg', '保存已取消', 'info');
         return;
    }

    try {
        app.ui.setLoading(true);
        
        // 1. 转换当前表格中所有数据（可能包含多个分类）
        const nestedData = convertToNested(state.data);
        
        // 2. 发送到 /api/data，后端将执行合并
        const result = await app.api.fetchAPI('/api/data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(nestedData)
        });
        
        if (result.status === 'ok') {
            app.ui.showMessage('msg', UI.MESSAGES.SAVE_SUCCESS + ' (分类列表已更新)', 'success');
            
            // 3. 刷新分类列表（因为可能创建了新分类）
            await loadCategories();
            
            // 4. 重新加载当前选中的分类的数据
            // （被移动走的词条会消失，新移入的词条...不会在这里显示，除非用户切换分类）
            await loadData(currentCategory);
        } else {
            throw new Error(result.msg || UI.MESSAGES.SAVE_ERROR);
        }
    } catch (error) {
        console.error('Error saving data:', error);
        app.ui.showMessage('msg', error.message, 'error');
    } finally {
        app.ui.setLoading(false);
    }
}

// [已修改] 加载分类列表
// (现在会记住并恢复当前选中的值)
async function loadCategories() {
    try {
        const categories = await app.api.fetchAPI('/api/categories');
        const select = document.getElementById('categorySelect');
        if (select) {
            const currentVal = select.value; // 1. 记住当前选中的值

            select.innerHTML = ''; // 2. 清空所有选项

            const fragment = document.createDocumentFragment();
            // 3. 添加默认选项
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "—— 请选择一个分类 ——";
            fragment.appendChild(defaultOption);

            // 4. 添加排序后的分类
            categories.sort(new Intl.Collator('zh-CN-u-co-pinyin').compare);
            categories.forEach(cat => {
                 const option = document.createElement('option');
                 option.value = cat;
                 option.textContent = cat;
                 fragment.appendChild(option);
            });
            
            select.appendChild(fragment);
            select.value = currentVal; // 5. 恢复选中的值
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        app.ui.showMessage('msg', '加载分类列表失败', 'error');
    }
}


// 初始化
window.addEventListener('DOMContentLoaded', function() {
    document.getElementById('saveToServer')?.addEventListener('click', saveToServer);
    document.getElementById('saveToServerTop')?.addEventListener('click', saveToServer);
    document.getElementById('addRow')?.addEventListener('click', addRow);
    document.getElementById('sortAndSaveBtn')?.addEventListener('click', sortAndSave);
    
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
        categorySelect.addEventListener('change', async (e) => {
            app.ui.setLoading(true, '.btn, .btn-delete');
            await loadData(e.target.value);
            app.ui.setLoading(false, '.btn, .btn-delete');
        });
    }

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
    
    loadCategories();
    renderTable(); // 渲染空表头
});