<h1 style="text-align: center;">NaiBotAssitant：NovelAI提示词组合助手</h1>

# 用途

目前有一位好心人在私人QQ群里提供了AI绘图，利用AI绘图+[NovelAI-bot](https://github.com/koishijs/novelai-bot)，鉴于关键词手写麻烦，于是写了这么一个程序。

# 功能

1. 词条录入，含分类、词条、译文、备注四条。
2. 词条组合，选择分类后，输入过滤字，勾选组合，点击复制，复制nai（QQ群中nai开头为唤起机器人的口令）+关键词，可选不在复制文本中增加nai，因为最近部署了自己的SD，直接关键词组合到SD-webui里。
3. 数据库批量编辑。

# 工具和借鉴

Python/Flask+Web页面+JavaScript

AI：使用Github Copilot/TRAE交替审查编写

词库保存在data.json中，仓库里的仅作为demo，在[个人甲骨文云服务器的应用部署页面](http://132.145.99.231:15252/)公开可下载。

参考了 [Danbooru 标签超市](https://tags.novelai.dev/) 项目中的词条数据，据此，对本仓库也采取AGPL3.0开放，此项目也有完善的关键词组合功能，但是我希望独立做一个更简洁的，且词条经过我测试验证再录入的。

# 运行方式

## 调试：直接

```bash
python app.py
```

## 服务器部署

```bash
sudo pip install waitress
nohup python waitress.py &
```

## （推荐）一键部署脚本

```bash
curl -o manage.sh https://raw.githubusercontent.com/self-exiler/NaiBotAssistant/main/manage.sh
chmod +x manage.sh
sudo ./manage.sh
```
