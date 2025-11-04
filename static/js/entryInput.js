// 表单验证规则
const validationRules = {
    category: {
        required: '请输入分类名称',
        maxLength: { value: 20, message: '分类名称不能超过20个字符' },
        pattern: { value: /^[\u4e00-\u9fa5a-zA-Z0-9\s\-]+$/, message: '分类名称格式不正确' }
    },
    term: {
        required: '请输入词条',
        maxLength: { value: 50, message: '词条不能超过50个字符' }
    },
    trans: {
        required: '请输入译文',
        maxLength: { value: 100, message: '译文不能超过100个字符' }
    },
    note: {
        maxLength: { value: 200, message: '备注不能超过200个字符' }
    }
};

// 验证单个字段
function validateField(fieldName, value) {
    const rules = validationRules[fieldName];
    if (!rules) return ''; // 没有规则，总是有效

    if (rules.required && !value.trim()) {
        return rules.required;
    }
    if (rules.maxLength && value.length > rules.maxLength.value) {
        return rules.maxLength.message;
    }
    if (rules.pattern && !rules.pattern.value.test(value)) {
        return rules.pattern.message;
    }
    return ''; // 无错误
}

// 提交表单数据
async function submitForm(formElement) {
    const submitButton = formElement.querySelector('button[type="submit"]');
    try {
        // [修改] 使用 app.ui.setLoading 来管理按钮状态
        app.ui.setLoading(true, 'button[type="submit"]');
        
        const response = await fetch('/api/add_entry', {
            method: 'POST',
            body: new FormData(formElement)
        });

        // [修改] 使用 app.api.fetchAPI (虽然这里是 FormData，但为了错误处理一致性，我们手动解析)
        const result = await response.json();
        
        if (!response.ok || result.status !== 'ok') {
            throw new Error(result.msg || '网络请求失败');
        }
        
        // [修改] 使用 app.ui.showMessage
        app.ui.showMessage('msg', '保存成功', 'success');
        formElement.reset();
        formElement.querySelector('input').focus(); // 成功后聚焦第一个输入框
        
        // 清除所有验证消息
        Object.keys(validationRules).forEach(fieldName => {
            // [修改] 使用 app.ui.showMessage
            app.ui.showMessage(`${fieldName}Help`, '', 'info'); 
        });

        // 成功提交后重新加载分类，以便新分类能出现在下拉列表中
        // [修改] 调用公共函数
        // (这里的 try...catch 是 submitForm 自己的)
        await app.ui.populateCategoryDatalist('category-list');

    } catch (error) {
        console.error('提交表单出错:', error);
        // [修改] 使用 app.ui.showMessage
        app.ui.showMessage('msg', error.message, 'error');
    } finally {
        // [修改] 使用 app.ui.setLoading
        app.ui.setLoading(false, 'button[type="submit"]');
    }
}

// 初始化表单处理
function initForm() {
    const form = document.getElementById('entryForm');
    if (!form) return;

    // 实时字段验证
    // [修改] 使用 app.utils.debounce
    form.addEventListener('input', app.utils.debounce((event) => {
        const field = event.target;
        if (field.name && validationRules[field.name]) {
            const errorMessage = validateField(field.name, field.value);
            // [修改] 使用 app.ui.showMessage
            // 'help' 消息应该被视为 'error' 类型（如果它有内容）
            app.ui.showMessage(`${field.id}Help`, errorMessage, errorMessage ? 'error' : 'info');
        }
    }, 300));

    // 表单提交处理
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        let isFormValid = true;
        Object.keys(validationRules).forEach(fieldName => {
            const field = this.elements[fieldName];
            if (field) {
                const errorMessage = validateField(fieldName, field.value);
                // [修改] 使用 app.ui.showMessage
                app.ui.showMessage(`${field.id}Help`, errorMessage, errorMessage ? 'error' : 'info');
                if (errorMessage) isFormValid = false;
            }
        });

        if (isFormValid) {
            submitForm(this);
        } else {
            // [修改] 使用 app.ui.showMessage
            app.ui.showMessage('msg', '请检查输入内容', 'error');
        }
    });
}

// 更新：页面加载完成后，除了初始化表单，还要加载分类列表
document.addEventListener('DOMContentLoaded', () => {
    
    // [修改] 增加 async init 函数来捕获初始加载错误
    async function initPage() {
        try {
            // 调用公共函数
            await app.ui.populateCategoryDatalist('category-list');
        } catch (error) {
            // 在 'categoryHelp' 区域显示错误
            app.ui.showMessage('categoryHelp', error.message, 'error');
            console.error(error);
        }
    }

    initForm(); // 初始化表单事件
    initPage(); // 异步加载 datalist
});