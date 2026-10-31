# Deck Dust

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Deck Dust** 是一款面向 Windows 的《炉石传说》收藏、套牌与开包记录管理工具。项目使用 React、Vite、Python 和 SQLite，数据默认保存在本机。

> 本项目由 AI 协助创建和维护。代码、界面设计与功能实现均由 AI 参与生成；项目维护者负责审阅、运行和发布。AI 生成内容可能存在错误，欢迎通过 Issue 或 Pull Request 指出。

## 功能

- 收藏管理：职业、扩展包、费用、稀有度、品质、持有状态和缺卡筛选。
- 套牌构筑：从收藏选牌，保存套牌，并导入或导出卡组代码及 JSON。
- 开包记录：记录卡牌品质与开包信息，并提供汇总分析。
- 本地存储：SQLite 数据保存在当前 Windows 用户数据目录，不应提交至版本库。
- 可选 HSReplay 同步与 Neon 备份功能；需用户自行配置凭据。

## 开始使用

需要 Node.js（建议 20 或更新版本）与 Python 3.12。桌面版还需要 Windows WebView2 Runtime。

```powershell
npm install
npm run build
python -m pip install -r desktop-requirements.txt
python desktop_app.py
```

开发网页：分别启动 `npm run dev:server` 和 `npm run dev`，再打开 Vite 显示的本地地址。

数据默认保存在 `%LOCALAPPDATA%\Deck Dust\Data`。首次使用可从应用内导入自己的收藏文件。请勿将真实收藏导出、数据库、登录会话或备份文件放入公开仓库。

## 截图

公开截图放在 `docs/screenshots/`。截图仅使用隔离演示数据，不包含真实账号、收藏、开包记录或本机路径。

## 文档

- [开发说明](DEVELOPMENT.md)
- [项目需求](PROJECT_REQUIREMENTS.md)
- [变更记录](CHANGELOG.md)
- [云备份约定](CLOUD_BACKUP.md)
- [第三方素材与许可说明](THIRD_PARTY_NOTICES.md)

## 隐私与安全

HSReplay 会话和 Neon 数据库连接串留在用户数据目录，并由 Windows DPAPI 保护。提交前检查 `git status` 和 `git diff --cached`，确认没有个人数据、凭据、数据库、导出文件或本机绝对路径。

## 免责声明

Deck Dust 与 Blizzard Entertainment、Hearthstone、HSReplay 或 HearthstoneJSON 无隶属关系。第三方商标、卡牌资料和图像归其各自权利人所有，见 [第三方说明](THIRD_PARTY_NOTICES.md)。
