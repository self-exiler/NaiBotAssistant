// 表单验证规则
const validationRules = {
    category: {
        required: true,
        minLength: 1,
        maxLength: 20,
        pattern: /^[\u4e00-\u9fa5a-zA-Z0-9\s]+$/,
        message: {
            required: '请输入分类名称',
            minLength: '分类名称不能为空',
            maxLength: '分类名称不能超过20个字符',
            pattern: '分类名称只能包含中文、英文、数字和空格'
        }
    },
    term: {
        required: true,
        minLength: 1,
        maxLength: 50,
        message: {
            required: '请输入词条',
            minLength: '词条不能为空',
            maxLength: '词条不能超过50个字符'
        }
    },
    trans: {
        required: true,
        minLength: 1,
        maxLength: 100,
        message: {
            required: '请输入译文',
            minLength: '译文不能为空',
            maxLength: '译文不能超过100个字符'
        }
    },
    note: {
        required: false,
        maxLength: 200,
        message: {
            maxLength: '备注不能超过200个字符'
        }
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
function validateField(field, value) {
    const rules = validationRules[field];
    if (!rules) return true;

    const errors = [];
    
    if (rules.required && !value.trim()) {
        errors.push(rules.message.required);
    }
    
    if (rules.minLength && value.trim().length < rules.minLength) {
        errors.push(rules.message.minLength);
    }
    
    if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(rules.message.maxLength);
    }
    
    if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(rules.message.pattern);
    }
    
    return errors;
}

// 显示验证消息
function showValidationMessage(fieldId, errors) {
    const helpElement = document.getElementById(`${fieldId}Help`);
    if (helpElement) {
        helpElement.textContent = errors.join(', ');
        helpElement.className = errors.length ? 'form-help error' : 'form-help';
    }
}

// 显示状态消息
function showStatusMessage(status, message) {
    const msgElement = document.getElementById('msg');
    if (!msgElement) return;

    clearTimeout(window.msgTimeout);
    
    msgElement.textContent = message;
    msgElement.className = `status-message ${status}`;
    msgElement.classList.add('shake-message');
    
    window.msgTimeout = setTimeout(() => {
        msgElement.textContent = '';
        msgElement.className = 'status-message';
    }, 2000);
}

// 提交表单数据
async function submitForm(formData) {
    try {
        const response = await fetch('/api/add_entry', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('网络请求失败');
        }

        const result = await response.json();
        
        if (result.status === 'ok') {
            showStatusMessage('success', '保存成功');
            return true;
        } else {
            showStatusMessage('error', result.msg || '保存失败');
            return false;
        }
    } catch (error) {
        console.error('提交表单出错:', error);
        showStatusMessage('error', '保存失败，请重试');
        return false;
    }
}

// 初始化表单处理
function initForm() {
    const form = document.getElementById('entryForm');
    if (!form) return;

    // 实时字段验证
    const validateOnInput = debounce((event) => {
        const field = event.target;
        const errors = validateField(field.name, field.value);
        showValidationMessage(field.id, errors);
    }, 300);

    // 添加输入事件监听
    Object.keys(validationRules).forEach(fieldName => {
        const field = form.elements[fieldName];
        if (field) {
            field.addEventListener('input', validateOnInput);
        }
    });

    // 表单提交处理
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // 验证所有字段
        let hasErrors = false;
        Object.keys(validationRules).forEach(fieldName => {
            const field = this.elements[fieldName];
            if (field) {
                const errors = validateField(fieldName, field.value);
                showValidationMessage(field.id, errors);
                if (errors.length) hasErrors = true;
            }
        });

        if (hasErrors) {
            showStatusMessage('error', '请检查输入内容');
            return;
        }

        // 提交表单
        const success = await submitForm(new FormData(this));
        if (success) {
            this.reset();
            // 清除所有验证消息
            Object.keys(validationRules).forEach(fieldName => {
                showValidationMessage(this.elements[fieldName].id, []);
            });
        }
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initForm);
