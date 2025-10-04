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

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

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

// 显示消息（合并了验证和状态消息）
function showMessage(elementId, message, type = 'info') {
    const msgElement = document.getElementById(elementId);
    if (!msgElement) return;

    clearTimeout(msgElement.timeoutId);
    
    msgElement.textContent = message;
    msgElement.className = `${type}-message`; // 使用更通用的类名
    
    if (type === 'success' || type === 'error') {
        msgElement.timeoutId = setTimeout(() => {
            msgElement.textContent = '';
            msgElement.className = '';
        }, 3000);
    }
}

// 提交表单数据
async function submitForm(formElement) {
    const submitButton = formElement.querySelector('button[type="submit"]');
    try {
        submitButton.disabled = true;
        submitButton.textContent = '保存中...';
        
        const response = await fetch('/api/add_entry', {
            method: 'POST',
            body: new FormData(formElement)
        });

        const result = await response.json();
        
        if (!response.ok || result.status !== 'ok') {
            throw new Error(result.msg || '网络请求失败');
        }
        
        showMessage('msg', '保存成功', 'success');
        formElement.reset();
        formElement.querySelector('input').focus(); // 成功后聚焦第一个输入框
        // 清除所有验证消息
        Object.keys(validationRules).forEach(fieldName => {
            showMessage(`${fieldName}Help`, '', 'info');
        });

        // 成功提交后重新加载分类，以便新分类能出现在下拉列表中
        await loadCategories();

    } catch (error) {
        console.error('提交表单出错:', error);
        showMessage('msg', error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '保存';
    }
}

// 新增：加载分类列表并填充到 datalist
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        if (!response.ok) {
            console.error('无法加载分类列表');
            return;
        }
        const categories = await response.json();
        const datalist = document.getElementById('category-list');
        if (datalist) {
            const fragment = document.createDocumentFragment();
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                fragment.appendChild(option);
            });
            datalist.innerHTML = ''; // 先清空旧的列表
            datalist.appendChild(fragment);
        }
    } catch (error) {
        console.error('加载分类列表时出错:', error);
    }
}


// 初始化表单处理
function initForm() {
    const form = document.getElementById('entryForm');
    if (!form) return;

    // 实时字段验证
    form.addEventListener('input', debounce((event) => {
        const field = event.target;
        if (field.name && validationRules[field.name]) {
            const errorMessage = validateField(field.name, field.value);
            showMessage(`${field.id}Help`, errorMessage, 'error');
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
                showMessage(`${field.id}Help`, errorMessage, 'error');
                if (errorMessage) isFormValid = false;
            }
        });

        if (isFormValid) {
            submitForm(this);
        } else {
            showMessage('msg', '请检查输入内容', 'error');
        }
    });
}

// 更新：页面加载完成后，除了初始化表单，还要加载分类列表
document.addEventListener('DOMContentLoaded', () => {
    initForm();
    loadCategories();
});
