let jsonData = [];
let columns = [];

// 读取 data.json（后端直接返回数组，每行带category）
fetch('/api/data')
    .then(res => res.json())
    .then(data => {
        jsonData = Array.isArray(data) ? data : [];
        if (!jsonData.length) {
            jsonData = [{category: '', term: '', trans: '', note: ''}];
        }
        renderTable();
    });

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
    jsonData.splice(row, 1);
    renderTable();
}
document.getElementById('addRow').onclick = function() {
    let newRow = {};
    columns.forEach(col => newRow[col] = '');
    jsonData.push(newRow);
    renderTable();
}
document.getElementById('downloadJson').onclick = function() {
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
}
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
    }
    reader.readAsText(file);
}
// 保存到服务器
function saveToServer() {
    fetch('/api/data', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(jsonData)
    }).then(res => res.json()).then(r => {
        if (r.status === 'ok') alert('保存成功');
        else alert('保存失败：' + r.msg);
    });
}
// 增加保存按钮
window.addEventListener('DOMContentLoaded', function() {
    let saveBtn = document.createElement('button');
    saveBtn.textContent = '保存到服务器';
    saveBtn.className = 'btn';
    saveBtn.onclick = saveToServer;
    document.body.insertBefore(saveBtn, document.getElementById('jsonTable'));
});
