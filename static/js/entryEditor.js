let jsonData = [];
let columns = [];
let isLoading = false;

// 显示加载状态
function setLoading(loading) {
    isLoading = loading;
    document.querySelectorAll('.btn').forEach(btn => {
        btn.disabled = loading;
    });
    if (loading) {
        document.getElementById('loading').style.display = 'block';
    } else {
        document.getElementById('loading').style.display = 'none';
    }
}

// 读取 data.json（后端直接返回数组，每行带category）
function loadData() {
    setLoading(true);
    fetch('/api/data')
        .then(res => {
            if (!res.ok) throw new Error('Network response was not ok');
            return res.json();
        })
        .then(data => {
            jsonData = Array.isArray(data) ? data : [];
            if (!jsonData.length) {
                jsonData = [{category: '', term: '', trans: '', note: ''}];
            }
            renderTable();
        })
        .catch(err => {
            alert('加载数据失败: ' + err.message);
        })
        .finally(() => {
            setLoading(false);
        });
}

function renderTable() {
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
    // 保证有列名
    if (!Array.isArray(jsonData) || jsonData.length === 0) {
        columns = ['category', 'term', 'trans', 'note'];
    } else {
        columns = Object.keys(jsonData[0]);
    }
    // 表头
    let headRow = '<tr>' + columns.map(col => `<th>${col}</th>`).join('') + '<th>操作</th></tr>';
    tableHead.innerHTML = headRow;
    // 表体
    if (Array.isArray(jsonData) && jsonData.length > 0) {
        jsonData.forEach((row, rowIndex) => {
            let rowHtml = '<tr>';
            columns.forEach(col => {
                rowHtml += `<td><input type='text' value="${row[col] ?? ''}" onchange="updateCell(${rowIndex}, '${col}', this.value)"></td>`;
            });
            rowHtml += `<td><button onclick="deleteRow(${rowIndex})">删除</button></td></tr>`;
            tableBody.innerHTML += rowHtml;
        });
    }
}

window.updateCell = function(row, col, value) {
    jsonData[row][col] = value;
}
window.deleteRow = function(row) {
    if (confirm('确定要删除这一行吗？')) {
        jsonData.splice(row, 1);
        renderTable();
    }
}

// 转换扁平数组为嵌套结构
function convertToNested(data) {
    const nested = {};
    data.forEach(item => {
        const category = item.category;
        if (!nested[category]) {
            nested[category] = [];
        }
        nested[category].push({
            term: item.term,
            trans: item.trans,
            note: item.note
        });
    });
    return nested;
}

// 保存到服务器
function saveToServer() {
    if (!confirm('确定要保存所有更改吗？')) return;
    
    setLoading(true);
    const nestedData = convertToNested(jsonData);
    
    fetch('/api/data', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(nestedData)
    })
    .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
    })
    .then(r => {
        if (r.status === 'ok') {
            alert('保存成功');
            loadData(); // 重新加载数据确保一致性
        } else {
            throw new Error(r.msg || '保存失败');
        }
    })
    .catch(err => {
        alert('保存失败: ' + err.message);
    })
    .finally(() => {
        setLoading(false);
    });
}
// 增加保存按钮和加载指示器
window.addEventListener('DOMContentLoaded', function() {
    // 添加加载指示器
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading';
    loadingDiv.style.display = 'none';
    loadingDiv.textContent = '加载中...';
    loadingDiv.style.margin = '10px 0';
    document.body.insertBefore(loadingDiv, document.getElementById('jsonTable'));
    
    // 添加保存按钮事件
    document.getElementById('saveToServer').onclick = saveToServer;
    document.getElementById('saveToServerTop').onclick = saveToServer;
    
    // 添加事件处理
    document.getElementById('addRow').onclick = function() {
        let newRow = {};
        columns.forEach(col => newRow[col] = '');
        jsonData.push(newRow);
        renderTable();
    };
    document.getElementById('downloadJson').onclick = function() {
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.json';
        a.click();
        URL.revokeObjectURL(url);
    };
    document.getElementById('uploadJson').onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                let data = JSON.parse(evt.target.result);
                jsonData = Array.isArray(data) ? data : [];
                renderTable();
            } catch (err) {
                alert('JSON 解析失败');
            }
        };
        reader.readAsText(file);
    };

    // 初始加载数据
    loadData();
});