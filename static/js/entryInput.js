// 极简 JS：提交表单
window.addEventListener('DOMContentLoaded', function() {
    var form = document.getElementById('entryForm');
    if (!form) return;
    form.addEventListener('submit', function(e){
        e.preventDefault();
        const fd = new FormData(this);
        fetch('/api/add_entry', {method:'POST', body: fd})
            .then(r => r.json())
            .then(j => {
                const msgElement = document.getElementById('msg');
                clearTimeout(window.msgTimeout);
                msgElement.textContent = j.status === 'ok' ? '已保存' : j.msg;
                msgElement.classList.add('shake-message');
                window.msgTimeout = setTimeout(() => {
                    msgElement.textContent = '';
                    msgElement.classList.remove('shake-message');
                }, 2000);
                if(j.status === 'ok') this.reset();
            });
    });
});
