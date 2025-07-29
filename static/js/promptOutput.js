const selectedSet = new Set();
// ---------- 初始化 ----------
fetch('/api/categories')
    .then(r => r.json())
    .then(arr => {
        const sel = document.getElementById('categorySelect');
        arr.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            sel.appendChild(opt);
        });
    });
// ---------- 切换分类 ----------
document.getElementById('categorySelect').addEventListener('change', function(){
    const category = this.value;
    if(!category) return;
    fetch('/api/terms/' + encodeURIComponent(category))
        .then(r => r.json())
        .then(terms => {
            renderTerms(terms);
            // 初始化搜索过滤
            document.getElementById('searchInput').addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const termItems = document.querySelectorAll('#termList label');
                termItems.forEach(item => {
                    const termText = item.textContent.toLowerCase();
                    item.style.display = termText.includes(searchTerm) ? '' : 'none';
                    const nextBr = item.nextElementSibling;
                    if(nextBr && nextBr.tagName === 'BR') {
                        nextBr.style.display = termText.includes(searchTerm) ? '' : 'none';
                    }
                });
            });
        });
});
// ---------- 渲染复选框 ----------
function renderTerms(terms){
    const container = document.getElementById('termList');
    container.innerHTML = '';
    terms.forEach(t => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.trans = t.trans;
        cb.checked = selectedSet.has(t.trans);
        cb.addEventListener('change', syncText);
        label.appendChild(cb);
        let text = ` ${t.term}`;
        if (t.note && t.note.trim()) {
            text += `（${t.note}）`;
        }
        label.append(text);
        container.appendChild(label);
        container.appendChild(document.createElement('br'));
    });
}
// ---------- 同步文本框 ----------
function syncText(){
    const cb = this;
    if(cb.checked){
        selectedSet.add(cb.dataset.trans);
    }else{
        selectedSet.delete(cb.dataset.trans);
    }
    document.getElementById('outputArea').value = [...selectedSet].join(', ');
}
// ---------- 复制 ----------
document.getElementById('copyBtn').addEventListener('click', function(){
    const text = 'nai ' + document.getElementById('outputArea').value;
    if(!text.trim()) return;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => alert('已复制'));
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            alert('已复制');
        } catch (err) {
            alert('复制失败，请手动复制');
        }
        document.body.removeChild(textarea);
    }
});