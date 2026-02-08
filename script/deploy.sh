#!/bin/bash
#
# NaiBotAssistant Linux 部署脚本
# 支持安装、升级、重启、配置端口
#

set -e

# 配置变量
APP_NAME="NaiBotAssistant"
INSTALL_DIR="/opt/naibotassistant"
SERVICE_NAME="naibotassistant"
GIT_REPO="https://github.com/self-exiler/NaiBotAssistant.git"
CONFIG_FILE="$INSTALL_DIR/config.json"
PYTHON_CMD="python3"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查是否以 root 运行
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "请以 root 权限运行此脚本"
        exit 1
    fi
}

# 检查依赖
check_dependencies() {
    print_info "检查系统依赖..."
    
    local missing=()
    
    if ! command -v python3 &> /dev/null; then
        missing+=("python3")
    fi
    
    if ! command -v pip3 &> /dev/null; then
        missing+=("python3-pip")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_warning "缺少依赖: ${missing[*]}"
        print_info "正在安装依赖..."
        
        if command -v apt-get &> /dev/null; then
            apt-get update && apt-get install -y "${missing[@]}"
        elif command -v yum &> /dev/null; then
            yum install -y "${missing[@]}"
        else
            print_error "无法自动安装依赖，请手动安装: ${missing[*]}"
            exit 1
        fi
    fi
    
    print_success "依赖检查完成"
}

# 创建 systemd 服务文件
create_service() {
    local port=$1
    
    print_info "创建 systemd 服务..."
    
    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=NaiBotAssistant - 提示词管理工具
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${PYTHON_CMD} ${INSTALL_DIR}/run.py --port ${port}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    print_success "服务创建完成"
}

# 安装应用
install_app() {
    print_info "开始安装 ${APP_NAME}..."
    
    # 检查是否已安装
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "检测到已安装的版本，是否覆盖安装？(y/n)"
        read -r confirm
        if [ "$confirm" != "y" ]; then
            print_info "取消安装"
            return
        fi
        rm -rf "$INSTALL_DIR"
    fi
    
    # 获取端口号
    echo -n "请输入服务端口号 [默认: 5000]: "
    read -r port
    port=${port:-5000}
    
    # 创建安装目录
    mkdir -p "$INSTALL_DIR"
    
    # 克隆应用
    print_info "正在从 GitHub 克隆应用..."
    print_info "仓库地址: $GIT_REPO"
    
    if git clone "$GIT_REPO" "$INSTALL_DIR"; then
        print_success "克隆完成"
    else
        print_error "克隆失败，请检查网络或仓库地址"
        rm -rf "$INSTALL_DIR"
        return
    fi
    
    # 安装 Python 依赖
    print_info "安装 Python 依赖..."
    pip3 install -r "$INSTALL_DIR/requirements.txt"
    
    # 初始化数据库
    print_info "初始化数据库..."
    cd "$INSTALL_DIR" && $PYTHON_CMD app/init_db.py
    
    # 更新配置文件端口
    if [ -f "$CONFIG_FILE" ]; then
        sed -i "s/\"port\": [0-9]*/\"port\": $port/" "$CONFIG_FILE"
    fi
    
    # 创建服务
    create_service "$port"
    
    # 启动服务
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"
    
    print_success "安装完成！"
    print_info "访问地址: http://localhost:$port"
    print_info "查看状态: systemctl status $SERVICE_NAME"
}

# 升级应用
upgrade_app() {
    print_info "开始升级 ${APP_NAME}..."
    
    if [ ! -d "$INSTALL_DIR" ]; then
        print_error "未检测到已安装的应用，请先安装"
        return
    fi
    
    # 备份数据库和配置
    print_info "备份数据和配置..."
    local backup_dir="/tmp/naibotassistant_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    cp -r "$INSTALL_DIR/database" "$backup_dir/" 2>/dev/null || true
    cp "$CONFIG_FILE" "$backup_dir/" 2>/dev/null || true
    
    # 停止服务
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    
    # 更新代码
    print_info "更新 GitHub 仓库代码..."
    if cd "$INSTALL_DIR" && git pull origin main 2>&1; then
        print_success "代码更新完成"
    else
        print_warning "Git pull 可能失败，尝试使用 git fetch 和 git reset"
        if cd "$INSTALL_DIR" && git fetch origin && git reset --hard origin/main; then
            print_success "代码强制更新完成"
        else
            print_error "代码更新失败，请检查网络或仓库权限"
            # 启动服务继续运行旧版本
            systemctl start "$SERVICE_NAME"
            return
        fi
    fi
    
    # 恢复数据和配置
    print_info "恢复数据和配置..."
    cp -r "$backup_dir/database" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$backup_dir/config.json" "$INSTALL_DIR/" 2>/dev/null || true
    
    # 更新依赖
    print_info "更新 Python 依赖..."
    pip3 install -r "$INSTALL_DIR/requirements.txt" --upgrade
    
    # 启动服务
    systemctl start "$SERVICE_NAME"
    
    print_success "升级完成！"
    print_info "备份文件保存在: $backup_dir"
}

# 重启服务
restart_service() {
    print_info "重启 ${APP_NAME} 服务..."
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl restart "$SERVICE_NAME"
        print_success "服务已重启"
    else
        print_warning "服务未运行，正在启动..."
        systemctl start "$SERVICE_NAME"
        print_success "服务已启动"
    fi
    
    systemctl status "$SERVICE_NAME" --no-pager
}

# 设置端口
set_port() {
    echo -n "请输入新的端口号: "
    read -r new_port
    
    if ! [[ "$new_port" =~ ^[0-9]+$ ]] || [ "$new_port" -lt 1 ] || [ "$new_port" -gt 65535 ]; then
        print_error "无效的端口号"
        return
    fi
    
    # 更新配置文件
    if [ -f "$CONFIG_FILE" ]; then
        sed -i "s/\"port\": [0-9]*/\"port\": $new_port/" "$CONFIG_FILE"
        print_success "配置文件已更新"
    fi
    
    # 更新服务文件
    create_service "$new_port"
    
    # 重启服务
    systemctl restart "$SERVICE_NAME" 2>/dev/null || true
    
    print_success "端口已更改为: $new_port"
    print_info "访问地址: http://localhost:$new_port"
}

# 仅创建服务（用于手动部署后）
create_service_only() {
    if [ ! -d "$INSTALL_DIR" ]; then
        print_error "请先将应用文件复制到 $INSTALL_DIR"
        return
    fi
    
    echo -n "请输入服务端口号 [默认: 5000]: "
    read -r port
    port=${port:-5000}
    
    # 安装依赖
    if [ -f "$INSTALL_DIR/requirements.txt" ]; then
        print_info "安装 Python 依赖..."
        pip3 install -r "$INSTALL_DIR/requirements.txt"
    fi
    
    # 初始化数据库
    if [ -f "$INSTALL_DIR/app/init_db.py" ]; then
        print_info "初始化数据库..."
        cd "$INSTALL_DIR" && $PYTHON_CMD app/init_db.py
    fi
    
    create_service "$port"
    
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"
    
    print_success "服务创建并启动完成！"
    print_info "访问地址: http://localhost:$port"
}

# 停止服务
stop_service() {
    print_info "停止 ${APP_NAME} 服务..."
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl stop "$SERVICE_NAME"
        print_success "服务已停止"
    else
        print_warning "服务未运行"
    fi
}

# 卸载服务
uninstall_service() {
    print_warning "卸载服务将禁用并删除 systemd 服务文件"
    echo -n "确认卸载服务？(y/n): "
    read -r confirm
    
    if [ "$confirm" != "y" ]; then
        print_info "已取消卸载"
        return
    fi
    
    print_info "卸载服务..."
    
    # 停止服务
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    
    # 禁用服务
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    
    # 删除服务文件
    if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
        rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
        systemctl daemon-reload
        print_success "服务已卸载"
    else
        print_warning "服务文件不存在"
    fi
}

# 删除程序
uninstall_app() {
    print_error "此操作将停止服务、卸载服务并删除所有应用文件和数据"
    echo -n "确认删除 ${APP_NAME}？此操作不可恢复！(y/n): "
    read -r confirm_1
    
    if [ "$confirm_1" != "y" ]; then
        print_info "已取消删除"
        return
    fi
    
    echo -n "请再次确认删除 (输入: yes): "
    read -r confirm_2
    
    if [ "$confirm_2" != "yes" ]; then
        print_info "已取消删除"
        return
    fi
    
    print_info "开始删除 ${APP_NAME}..."
    
    # 停止并卸载服务
    print_info "停止并卸载服务..."
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload 2>/dev/null || true
    
    # 删除应用目录
    print_info "删除应用文件..."
    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
        print_success "应用文件已删除"
    else
        print_warning "应用目录不存在"
    fi
    
    print_success "删除完成！${APP_NAME} 已完全卸载"
}

# 查看状态
show_status() {
    print_info "${APP_NAME} 服务状态:"
    echo ""
    systemctl status "$SERVICE_NAME" --no-pager 2>/dev/null || print_warning "服务未安装"
}

# 主菜单
show_menu() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║         NaiBotAssistant Linux 部署脚本                     ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  1. 下载并安装"
    echo "  2. 升级应用"
    echo "  3. 重启服务"
    echo "  4. 设置端口"
    echo "  5. 仅创建服务 (手动部署后使用)"
    echo "  6. 查看状态"
    echo "  7. 停止服务"
    echo "  8. 卸载服务"
    echo "  9. 删除程序 (完全卸载)"
    echo "  0. 退出"
    echo ""
    echo -n "请选择操作 [0-9]: "
}

# 主函数
main() {
    check_root
    check_dependencies
    
    while true; do
        show_menu
        read -r choice
        
        case $choice in
            1) install_app ;;
            2) upgrade_app ;;
            3) restart_service ;;
            4) set_port ;;
            5) create_service_only ;;
            6) show_status ;;
            7) stop_service ;;
            8) uninstall_service ;;
            9) uninstall_app ;;
            0) 
                print_info "退出"
                exit 0
                ;;
            *)
                print_error "无效选项"
                ;;
        esac
    done
}

main
