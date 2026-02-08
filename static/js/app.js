// NaiBotAssistant 主应用程序
// 使用后端API获取真实数据

class NaiBotAssistant {
    constructor() {
        this.currentPage = 'home';
        this.selectedPrompts = new Set(); // 用于词条组合页面的状态保持
        this.selectedPromptsData = {}; // 存储选中词条的详细信息
        this.currentPageNum = 1;
        this.pageSize = 100;
        this.totalPages = 1;
        this.selectedItems = new Set(); // 用于批量管理的选中状态

        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialPage();
        this.loadPageData();
    }

    // 绑定事件监听器
    bindEvents() {
        // 导航菜单
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page;
                this.showPage(page);
            });
        });

        // 功能卡片点击
        document.querySelectorAll('.feature-card').forEach(card => {
            card.addEventListener('click', () => {
                const page = card.dataset.page;
                this.showPage(page);
            });
        });

        // 移动端导航切换
        const navToggle = document.getElementById('navToggle');
        const navMenu = document.getElementById('navMenu');
        if (navToggle) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        // 词条录入表单
        this.bindAddFormEvents();

        // 词条组合页面事件
        this.bindCombineEvents();

        // 批量管理页面事件
        this.bindManageEvents();

        // 备份管理页面事件
        this.bindBackupEvents();

        // 通用事件
        this.bindCommonEvents();
    }

    // 绑定词条录入表单事件
    bindAddFormEvents() {
        const addForm = document.getElementById('addForm');
        if (addForm) {
            addForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddPrompt();
            });
        }

        // 新分类切换
        const useNewCategory = document.getElementById('useNewCategory');
        const categorySelect = document.getElementById('category');
        const newCategoryInput = document.getElementById('newCategory');

        if (useNewCategory) {
            useNewCategory.addEventListener('change', (e) => {
                if (e.target.checked) {
                    categorySelect.style.display = 'none';
                    newCategoryInput.style.display = 'block';
                    newCategoryInput.required = true;
                    categorySelect.required = false;
                } else {
                    categorySelect.style.display = 'block';
                    newCategoryInput.style.display = 'none';
                    newCategoryInput.required = false;
                    categorySelect.required = true;
                }
            });
        }
    }

    // 绑定词条组合页面事件
    bindCombineEvents() {
        const categorySelect = document.getElementById('combineCategory');
        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                this.loadCombinePrompts();
            });
        }

        const copyBtn = document.getElementById('copyBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.copyToClipboard();
            });
        }

        // 命令前缀复选框
        const usePrefix = document.getElementById('usePrefix');
        if (usePrefix) {
            usePrefix.addEventListener('change', () => {
                this.updatePreviewText();
            });
        }
    }

    // 绑定批量管理页面事件
    bindManageEvents() {
        const categoryFilter = document.getElementById('manageCategory');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.loadManagePrompts();
            });
        }

        const selectAll = document.getElementById('selectAll');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                this.handleSelectAll(e.target.checked);
            });
        }

        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');

        if (prevPage) {
            prevPage.addEventListener('click', () => {
                if (this.currentPageNum > 1) {
                    this.currentPageNum--;
                    this.loadManagePrompts();
                }
            });
        }

        if (nextPage) {
            nextPage.addEventListener('click', () => {
                if (this.currentPageNum < this.totalPages) {
                    this.currentPageNum++;
                    this.loadManagePrompts();
                }
            });
        }

        const deleteSelected = document.getElementById('deleteSelected');
        if (deleteSelected) {
            deleteSelected.addEventListener('click', () => {
                this.handleDeleteSelected();
            });
        }
    }

    // 绑定备份管理页面事件
    bindBackupEvents() {
        const exportCsv = document.getElementById('exportCsv');
        const exportDb = document.getElementById('exportDb');
        const restoreCsv = document.getElementById('restoreCsv');
        const restoreDb = document.getElementById('restoreDb');

        if (exportCsv) {
            exportCsv.addEventListener('click', () => this.exportCSV());
        }

        if (exportDb) {
            exportDb.addEventListener('click', () => this.exportDB());
        }

        if (restoreCsv) {
            restoreCsv.addEventListener('click', () => this.restoreCSV());
        }

        if (restoreDb) {
            restoreDb.addEventListener('click', () => this.restoreDB());
        }
    }

    // 绑定通用事件
    bindCommonEvents() {
        // 消息关闭按钮
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('message-close')) {
                this.hideMessage();
            }
        });

        // 确认对话框
        const confirmCancel = document.getElementById('confirmCancel');
        const confirmOk = document.getElementById('confirmOk');

        if (confirmCancel) {
            confirmCancel.addEventListener('click', () => {
                this.hideConfirm();
            });
        }

        if (confirmOk) {
            confirmOk.addEventListener('click', () => {
                this.handleConfirm();
            });
        }

        // 编辑对话框
        const editCancel = document.getElementById('editCancel');
        const editSave = document.getElementById('editSave');

        if (editCancel) {
            editCancel.addEventListener('click', () => {
                this.hideEditModal();
            });
        }

        if (editSave) {
            editSave.addEventListener('click', () => {
                this.handleSaveEdit();
            });
        }

        // 编辑对话框中的新分类切换
        const useEditNewCategory = document.getElementById('useEditNewCategory');
        const editCategorySelect = document.getElementById('editCategory');
        const editNewCategoryInput = document.getElementById('editNewCategory');

        if (useEditNewCategory) {
            useEditNewCategory.addEventListener('change', (e) => {
                if (e.target.checked) {
                    editCategorySelect.style.display = 'none';
                    editNewCategoryInput.style.display = 'block';
                    editNewCategoryInput.required = true;
                    editCategorySelect.required = false;
                } else {
                    editCategorySelect.style.display = 'block';
                    editNewCategoryInput.style.display = 'none';
                    editNewCategoryInput.required = false;
                    editCategorySelect.required = true;
                }
            });
        }
    }

    // 初始化页面
    loadInitialPage() {
        this.showPage('home');
    }

    // 加载页面数据
    loadPageData() {
        this.updateCategoryOptions();
    }

    // 显示指定页面
    showPage(pageName) {
        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 显示目标页面
        const targetPage = document.getElementById(`${pageName}Page`);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        // 更新导航状态
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`[data-page="${pageName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // 更新当前页面
        this.currentPage = pageName;

        // 根据页面加载相应数据
        switch (pageName) {
            case 'add':
                this.prepareAddPage();
                break;
            case 'combine':
                this.prepareCombinePage();
                break;
            case 'manage':
                this.prepareManagePage();
                break;
            case 'backup':
                this.prepareBackupPage();
                break;
        }

        // 关闭移动端菜单
        const navMenu = document.getElementById('navMenu');
        if (navMenu) {
            navMenu.classList.remove('active');
        }
    }

    // 准备词条录入页面
    prepareAddPage() {
        this.updateCategoryOptions();
    }

    // 准备词条组合页面
    prepareCombinePage() {
        this.updateCategoryOptions();
        this.loadCombinePrompts();
    }

    // 准备批量管理页面
    prepareManagePage() {
        this.updateCategoryOptions();
        this.loadManagePrompts();
    }

    // 准备备份管理页面
    prepareBackupPage() {
        // 备份管理页面主要使用静态功能，不需要特别准备
    }

    // 更新分类选项
    async updateCategoryOptions() {
        try {
            // 从API获取分类
            const result = await this.apiCall('/api/v1/categories');
            const categories = result.data.map(cat => cat.name);

            // 更新所有分类下拉框
            const categorySelects = document.querySelectorAll('#category, #combineCategory, #manageCategory, #editCategory');
            categorySelects.forEach(select => {
                const currentValue = select.value;
                const firstOptionText = select.id === 'category' ? '请选择分类' : '所有分类';
                select.innerHTML = `<option value="">${firstOptionText}</option>`;
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    select.appendChild(option);
                });
                select.value = currentValue;
            });
        } catch (error) {
            console.error('加载分类失败:', error);
        }
    }

    // 处理词条录入
    async handleAddPrompt() {
        const form = document.getElementById('addForm');
        const messageDiv = document.getElementById('formMessage');

        if (!form || !messageDiv) return;

        const formData = new FormData(form);
        const data = {
            category: formData.get('useNewCategory') === 'on' ? formData.get('newCategory') : formData.get('category'),
            name: formData.get('name'),
            translation: formData.get('translation'),
            comment: formData.get('comment') || ''
        };

        // 验证必填字段
        if (!data.category || !data.name || !data.translation) {
            this.showFormMessage('请填写所有必填字段', 'error');
            return;
        }

        try {
            this.showLoading();

            // 调用真实API
            const result = await this.apiCall('/api/v1/prompts', 'POST', data);

            this.showFormMessage('词条录入成功！', 'success');
            form.reset();

            // 更新其他页面的数据
            this.updateCategoryOptions();

        } catch (error) {
            this.showFormMessage('录入失败：' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 显示表单消息
    showFormMessage(message, type) {
        const messageDiv = document.getElementById('formMessage');
        if (!messageDiv) return;

        messageDiv.textContent = message;
        messageDiv.className = `form-message ${type}`;
        messageDiv.style.display = 'block';

        // 3秒后自动隐藏
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    }

    // 加载词条组合页面的词条
    async loadCombinePrompts() {
        const category = document.getElementById('combineCategory')?.value || '';
        const promptsList = document.getElementById('promptsList');
        if (!promptsList) return;

        try {
            // 从LAPI获取词条
            const url = category ? `/api/v1/prompts?category=${encodeURIComponent(category)}&limit=1000` : '/api/v1/prompts?limit=1000';
            const result = await this.apiCall(url);
            const prompts = result.data.prompts;

            promptsList.innerHTML = '';

            prompts.forEach(prompt => {
                const item = document.createElement('div');
                item.className = 'prompt-item';

                const isSelected = this.selectedPrompts.has(prompt.id);
                const commentHtml = prompt.comment ? `<div class="prompt-comment">${prompt.comment}</div>` : '';
                item.innerHTML = `
                    <input type="checkbox" class="prompt-checkbox" ${isSelected ? 'checked' : ''} data-id="${prompt.id}">
                    <div class="prompt-info">
                        <div class="prompt-name">${prompt.name}</div>
                        ${commentHtml}
                    </div>
                `;

                const checkbox = item.querySelector('.prompt-checkbox');
                checkbox.addEventListener('change', (e) => {
                    this.handlePromptSelection(prompt, e.target.checked);
                });

                promptsList.appendChild(item);
            });

            this.updateSelectedCount();
            this.updatePreviewText();
        } catch (error) {
            console.error('加载词条失败:', error);
            promptsList.innerHTML = '<p style="text-align:center;color:#999;">加载失败，请重试</p>';
        }
    }

    // 处理词条选择
    handlePromptSelection(prompt, isSelected) {
        if (isSelected) {
            this.selectedPrompts.add(prompt.id);
            this.selectedPromptsData[prompt.id] = prompt;
        } else {
            this.selectedPrompts.delete(prompt.id);
            delete this.selectedPromptsData[prompt.id];
        }

        this.updateSelectedCount();
        this.updatePreviewText();
    }

    // 更新选中计数
    updateSelectedCount() {
        const selectedCount = document.getElementById('selectedCount');
        if (selectedCount) {
            const count = this.selectedPrompts.size;
            selectedCount.textContent = `已选择 ${count} 个词条`;
        }
    }

    // 更新预览文本
    updatePreviewText() {
        const previewText = document.getElementById('previewText');
        const copyBtn = document.getElementById('copyBtn');

        if (!previewText) return;

        const translations = Array.from(this.selectedPrompts).map(id => {
            const prompt = this.selectedPromptsData[id];
            return prompt ? prompt.translation : '';
        }).filter(t => t);

        let text = translations.join(', ');

        // 添加前缀
        const usePrefix = document.getElementById('usePrefix')?.checked;
        if (usePrefix && text) {
            text = `Nai ${text}`;
        }

        previewText.textContent = text || '选择的词条译文将在这里显示';

        if (copyBtn) {
            copyBtn.disabled = !translations.length;
        }
    }

    // 复制到剪贴板
    async copyToClipboard() {
        const previewText = document.getElementById('previewText');
        if (!previewText) return;

        const text = previewText.textContent;
        if (!text || text === '选择的词条译文将在这里显示') {
            this.showMessage('没有可复制的内容', 'warning');
            return;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            this.showMessage('复制成功！', 'success');
        } catch (error) {
            this.showMessage('复制失败：' + error.message, 'error');
        }
    }

    // 加载批量管理页面的词条
    async loadManagePrompts() {
        const category = document.getElementById('manageCategory')?.value || '';

        try {
            // 从LAPI获取词条
            const url = category
                ? `/api/v1/prompts?category=${encodeURIComponent(category)}&page=${this.currentPageNum}&limit=${this.pageSize}&sort=name_asc`
                : `/api/v1/prompts?page=${this.currentPageNum}&limit=${this.pageSize}&sort=name_asc`;

            const result = await this.apiCall(url);
            const prompts = result.data.prompts;
            const pagination = result.data.pagination;

            // 更新分页信息
            this.totalPages = pagination.pages;
            this.updatePagination();

            // 渲染表格
            const tbody = document.getElementById('promptsTableBody');
            if (!tbody) return;

            tbody.innerHTML = '';

            prompts.forEach(prompt => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><input type="checkbox" class="form-checkbox" data-id="${prompt.id}"></td>
                    <td>${prompt.category}</td>
                    <td>${prompt.name}</td>
                    <td>${prompt.translation}</td>
                    <td>${prompt.comment || '-'}</td>
                    <td class="table-actions-cell">
                        <button class="edit-btn" data-id="${prompt.id}">编辑</button>
                        <button class="delete-btn" data-id="${prompt.id}">删除</button>
                    </td>
                `;
                tbody.appendChild(row);
            });

            // 绑定表格事件
            this.bindTableEvents();
        } catch (error) {
            console.error('加载词条失败:', error);
            const tbody = document.getElementById('promptsTableBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">加载失败，请重试</td></tr>';
            }
        }
    }

    // 绑定表格事件
    bindTableEvents() {
        // 复选框事件
        document.querySelectorAll('#promptsTableBody input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                if (e.target.checked) {
                    this.selectedItems.add(id);
                } else {
                    this.selectedItems.delete(id);
                }
                this.updateSelectedActions();
                this.updateSelectAllCheckbox();
            });
        });

        // 编辑按钮
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                this.editPrompt(id);
            });
        });

        // 删除按钮
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                this.deletePrompt(id);
            });
        });
    }

    // 更新选中操作按钮状态
    updateSelectedActions() {
        const deleteSelected = document.getElementById('deleteSelected');
        if (deleteSelected) {
            deleteSelected.disabled = this.selectedItems.size === 0;
        }
    }

    // 更新全选复选框
    updateSelectAllCheckbox() {
        const selectAll = document.getElementById('selectAll');
        const checkboxes = document.querySelectorAll('#promptsTableBody input[type="checkbox"]');

        if (selectAll && checkboxes.length > 0) {
            const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
            selectAll.checked = checkedCount === checkboxes.length;
            selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
        }
    }

    // 处理全选
    handleSelectAll(isChecked) {
        document.querySelectorAll('#promptsTableBody input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = isChecked;
            const id = parseInt(checkbox.dataset.id);
            if (isChecked) {
                this.selectedItems.add(id);
            } else {
                this.selectedItems.delete(id);
            }
        });
        this.updateSelectedActions();
    }

    // 编辑词条
    async editPrompt(id) {
        try {
            this.showLoading();
            const result = await this.apiCall(`/api/v1/prompts/${id}`);
            const prompt = result.data;

            // 重置新分类切换状态
            const useEditNewCategory = document.getElementById('useEditNewCategory');
            const editCategorySelect = document.getElementById('editCategory');
            const editNewCategoryInput = document.getElementById('editNewCategory');

            if (useEditNewCategory) {
                useEditNewCategory.checked = false;
                editCategorySelect.style.display = 'block';
                editNewCategoryInput.style.display = 'none';
                editNewCategoryInput.required = false;
                editCategorySelect.required = true;
                editNewCategoryInput.value = '';
            }

            // 填充表单
            document.getElementById('editId').value = prompt.id;
            document.getElementById('editCategory').value = prompt.category;
            document.getElementById('editName').value = prompt.name;
            document.getElementById('editTranslation').value = prompt.translation;
            document.getElementById('editComment').value = prompt.comment || '';

            // 显示模态框
            this.showEditModal();
        } catch (error) {
            this.showMessage('获取词条详情失败：' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 显示编辑模态框
    showEditModal() {
        const modal = document.getElementById('editPromptModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    // 隐藏编辑模态框
    hideEditModal() {
        const modal = document.getElementById('editPromptModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 保存编辑
    async handleSaveEdit() {
        const form = document.getElementById('editForm');
        if (!form) return;

        const formData = new FormData(form);
        const id = formData.get('id');
        const data = {
            category: formData.get('newCategory') && document.getElementById('useEditNewCategory').checked
                ? formData.get('newCategory')
                : formData.get('category'),
            name: formData.get('name'),
            translation: formData.get('translation'),
            comment: formData.get('comment') || ''
        };

        if (!data.category || !data.name || !data.translation) {
            this.showMessage('请填写所有必填字段', 'error');
            return;
        }

        try {
            this.showLoading();
            await this.apiCall(`/api/v1/prompts/${id}`, 'PUT', data);

            this.hideEditModal();
            this.showMessage('词条更新成功！', 'success');
            this.loadManagePrompts(); // 刷新列表
        } catch (error) {
            this.showMessage('更新失败：' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 删除词条
    deletePrompt(id) {
        this.showConfirm(`确定要删除此词条吗？此操作无法撤销。`, async () => {
            try {
                this.showLoading();
                await this.apiCall(`/api/v1/prompts/${id}`, 'DELETE');
                this.showMessage('删除成功', 'success');
                this.loadManagePrompts();
            } catch (error) {
                this.showMessage('删除失败：' + error.message, 'error');
            } finally {
                this.hideLoading();
            }
        });
    }

    // 批量删除选中
    handleDeleteSelected() {
        if (this.selectedItems.size === 0) return;

        this.showConfirm(`确定要删除选中的 ${this.selectedItems.size} 条词条吗？`, async () => {
            try {
                this.showLoading();
                const ids = Array.from(this.selectedItems);
                await this.apiCall('/api/v1/prompts/batch', 'DELETE', { ids });

                this.showMessage(`成功删除 ${ids.length} 条词条`, 'success');
                this.selectedItems.clear();
                this.loadManagePrompts();
            } catch (error) {
                this.showMessage('删除失败：' + error.message, 'error');
            } finally {
                this.hideLoading();
            }
        });
    }

    // 更新分页信息
    updatePagination() {
        const pageInfo = document.getElementById('pageInfo');
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');

        if (pageInfo) {
            pageInfo.textContent = `第 ${this.currentPageNum} 页，共 ${this.totalPages} 页`;
        }

        if (prevPage) {
            prevPage.disabled = this.currentPageNum <= 1;
        }

        if (nextPage) {
            nextPage.disabled = this.currentPageNum >= this.totalPages;
        }
    }

    // 导出CSV
    async exportCSV() {
        try {
            this.showLoading();
            // 直接触发文件下载
            window.location.href = '/api/v1/backup/export/csv';
            this.showMessage('CSV导出已启动', 'success');
        } catch (error) {
            this.showMessage('导出失败：' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 导出数据库
    async exportDB() {
        try {
            this.showLoading();
            // 直接触发文件下载
            window.location.href = '/api/v1/backup/export/db';
            this.showMessage('数据库导出已启动', 'success');
        } catch (error) {
            this.showMessage('导出失败：' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 恢复CSV
    async restoreCSV() {
        const fileInput = document.getElementById('csvFile');
        const mode = document.querySelector('input[name="csvMode"]:checked')?.value || 'increment';

        if (!fileInput || !fileInput.files.length) {
            this.showMessage('请选择CSV文件', 'warning');
            return;
        }

        try {
            this.showLoading();

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            // 选择正确的API端点
            const url = mode === 'replace' ? '/api/v1/backup/restore/csv/replace' : '/api/v1/backup/restore/csv/increment';

            await this.apiCall(url, 'POST', formData, true);

            this.showMessage('CSV恢复成功！', 'success');
            fileInput.value = '';

            // 重新加载数据
            this.updateCategoryOptions();
            this.loadManagePrompts();
        } catch (error) {
            this.showMessage('恢复失败：' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 恢复数据库
    async restoreDB() {
        const fileInput = document.getElementById('dbFile');
        const mode = document.querySelector('input[name="dbMode"]:checked')?.value || 'increment';

        if (!fileInput || !fileInput.files.length) {
            this.showMessage('请选择数据库文件', 'warning');
            return;
        }

        // 覆盖恢复需要确认
        if (mode === 'replace') {
            this.showConfirm('覆盖恢复将完全替换现有数据，确定要继续吗？', async () => {
                await this.performDbRestore(fileInput, mode);
            });
        } else {
            await this.performDbRestore(fileInput, mode);
        }
    }

    // 执行数据库恢复
    async performDbRestore(fileInput, mode) {
        try {
            this.showLoading();

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('mode', mode);

            await this.apiCall('/api/v1/backup/restore/db', 'POST', formData, true);

            this.showMessage('数据库恢复成功！', 'success');
            fileInput.value = '';

            // 重新加载数据
            this.updateCategoryOptions();
            this.loadManagePrompts();
        } catch (error) {
            this.showMessage('恢复失败：' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // API调用方法
    async apiCall(url, method = 'GET', data = null, isFormData = false) {
        try {
            const options = {
                method: method,
                headers: {}
            };

            if (data && !isFormData) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(data);
            } else if (data && isFormData) {
                // FormData会自动设置Content-Type
                options.body = data;
            }

            const response = await fetch(url, options);
            const result = await response.json();

            if (result.code >= 200 && result.code < 300) {
                return result;
            } else {
                throw new Error(result.message || '请求失败');
            }
        } catch (error) {
            console.error('API调用失败:', error);
            throw error;
        }
    }

    // 显示加载状态
    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'flex';
        }
    }

    // 隐藏加载状态
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    // 显示消息
    showMessage(message, type = 'success') {
        const messageDiv = document.getElementById('message');
        const messageText = messageDiv?.querySelector('.message-text');
        const messageContent = messageDiv?.querySelector('.message-content');

        if (!messageDiv || !messageText || !messageContent) return;

        messageText.textContent = message;
        messageContent.className = `message-content ${type}`;
        messageDiv.style.display = 'block';

        // 3秒后自动隐藏
        setTimeout(() => {
            this.hideMessage();
        }, 3000);
    }

    // 隐藏消息
    hideMessage() {
        const message = document.getElementById('message');
        if (message) {
            message.style.display = 'none';
        }
    }

    // 显示确认对话框
    showConfirm(message, callback) {
        const modal = document.getElementById('confirmModal');
        const modalText = modal?.querySelector('.modal-text');

        if (!modal || !modalText) return;

        modalText.textContent = message;
        modal.style.display = 'flex';

        // 保存回调函数
        this.confirmCallback = callback;
    }

    // 隐藏确认对话框
    hideConfirm() {
        const modal = document.getElementById('confirmModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.confirmCallback = null;
    }

    // 处理确认操作
    handleConfirm() {
        if (this.confirmCallback) {
            this.confirmCallback();
        }
        this.hideConfirm();
    }
}

// 全局函数，供HTML调用
function showPage(pageName) {
    if (window.naibotApp) {
        window.naibotApp.showPage(pageName);
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.naibotApp = new NaiBotAssistant();
});

// 键盘快捷键支持
document.addEventListener('keydown', (e) => {
    // ESC键关闭对话框
    if (e.key === 'Escape') {
        if (window.naibotApp) {
            window.naibotApp.hideConfirm();
            window.naibotApp.hideMessage();
        }
    }

    // Ctrl+C 在组合页面复制
    if (e.ctrlKey && e.key === 'c' && window.naibotApp?.currentPage === 'combine') {
        e.preventDefault();
        window.naibotApp.copyToClipboard();
    }
});