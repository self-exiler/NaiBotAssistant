#!/bin/bash

# 项目相关变量
REPO_URL="https://github.com/self-exiler/NaiBotAssistant.git"  # 替换为实际的GitHub仓库地址
PROJECT_DIR="/opt/NaiAssistant"
SERVICE_NAME="naiassistant"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

# 打印帮助信息
function print_help() {
    echo "Usage: $0 {install|update|start|restart|stop|uninstall}"
}

# 安装函数
function install() {
    echo "Installing NaiAssistant..."

    # 克隆仓库
    if [ ! -d "$PROJECT_DIR" ]; then
        git clone $REPO_URL $PROJECT_DIR || { echo "Failed to clone repository."; exit 1; }
    else
        echo "Project directory already exists. Skipping clone."
    fi

    # 安装依赖
    if [ -f "$PROJECT_DIR/requirements.txt" ]; then
        pip install -r $PROJECT_DIR/requirements.txt || { echo "Failed to install dependencies."; exit 1; }
    fi

    # 创建 systemd 服务文件
    echo "Creating systemd service file..."
    cat <<EOF > $SERVICE_FILE
[Unit]
Description=NaiAssistant Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 $PROJECT_DIR/run_server.py
WorkingDirectory=$PROJECT_DIR
Restart=always
User=$(whoami)

[Install]
WantedBy=multi-user.target
EOF

    # 重新加载 systemd 并启用服务
    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    echo "Installation complete. Use '$0 start' to start the service."
}

# 更新函数
function update() {
    echo "Updating NaiAssistant..."
    if [ -d "$PROJECT_DIR" ]; then
        cd $PROJECT_DIR || { echo "Project directory not found."; exit 1; }
        git pull || { echo "Failed to pull latest changes."; exit 1; }
        echo "Update complete. Restarting service..."
        restart
    else
        echo "Project directory does not exist. Please install first."
    fi
}

# 启动函数
function start() {
    echo "Starting NaiAssistant..."
    systemctl start $SERVICE_NAME || { echo "Failed to start service."; exit 1; }
    echo "Service started."
}

# 重启函数
function restart() {
    echo "Restarting NaiAssistant..."
    systemctl restart $SERVICE_NAME || { echo "Failed to restart service."; exit 1; }
    echo "Service restarted."
}

# 停止函数
function stop() {
    echo "Stopping NaiAssistant..."
    systemctl stop $SERVICE_NAME || { echo "Failed to stop service."; exit 1; }
    echo "Service stopped."
}

# 卸载函数
function uninstall() {
    echo "Uninstalling NaiAssistant..."
    stop
    echo "Removing project directory..."
    rm -rf $PROJECT_DIR || { echo "Failed to remove project directory."; exit 1; }
    echo "Removing systemd service file..."
    rm -f $SERVICE_FILE || { echo "Failed to remove service file."; exit 1; }
    systemctl daemon-reload
    echo "Uninstallation complete."
}

# 增加设置端口和日志等级的功能
function configure() {
    echo "当前配置:"
    echo "端口: $(jq -r '.port' system.json)"
    echo "日志等级: $(jq -r '.log_level' system.json)"

    read -p "请输入新的端口号（留空保持不变）: " new_port
    read -p "请输入新的日志等级（debug, info, warn, error，留空保持不变）: " new_log_level

    if [ ! -z "$new_port" ]; then
        jq ".port = $new_port" system.json > system_tmp.json && mv system_tmp.json system.json
        echo "端口已更新为 $new_port"
    fi

    if [ ! -z "$new_log_level" ]; then
        jq ".log_level = \"$new_log_level\"" system.json > system_tmp.json && mv system_tmp.json system.json
        echo "日志等级已更新为 $new_log_level"
    fi
}

# 增加上载备份数据文件的功能
function upload_backup() {
    echo "正在上载 data.json 到程序目录..."
    if [ -f "data.json" ]; then
        cp data.json $PROJECT_DIR/data.json || { echo "备份失败。"; exit 1; }
        echo "备份成功。"
    else
        echo "当前目录下未找到 data.json 文件。"
    fi
}

# 替换主逻辑为交互式菜单
while true; do
    echo "\n请选择一个操作:"
    echo "1) 安装"
    echo "2) 更新"
    echo "3) 启动"
    echo "4) 重启"
    echo "5) 停止"
    echo "6) 卸载"
    echo "7) 设置端口和日志等级"
    echo "8) 上载备份数据文件"
    echo "9) 退出"
    read -p "输入选项编号: " choice

    case "$choice" in
        1)
            install
            ;;
        2)
            update
            ;;
        3)
            start
            ;;
        4)
            restart
            ;;
        5)
            stop
            ;;
        6)
            uninstall
            ;;
        7)
            configure
            ;;
        8)
            upload_backup
            ;;
        9)
            echo "退出脚本."
            break
            ;;
        *)
            echo "无效选项，请重新输入."
            ;;
    esac
done