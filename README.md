# Re:Zero mdBook 离线复刻

对 <https://re0zero.top/mdbook/book/index.html> 的本地离线视觉复刻，保留原站的
mdBook 布局、字体、响应式断点、主题切换、可折叠目录、搜索界面、首页插画和
打赏区。

> 本站点及其中的文字、图片、字体归原作者所有。本仓库是非官方本地镜像，与
> 原站无关，仅供离线阅读和学习。

## 功能

- 桌面与移动端布局复刻，保留 mdBook 的侧边栏与章节目录。
- 亮色 / 暗色 / Ayu 主题切换。
- 本地搜索索引（`searchindex.js` / `searchindex.json`）。
- 完整离线镜像：同步原站全部页面、图片、样式、字体和搜索索引。
- 本地静态服务器，支持端口配置和自动打开浏览器。
- 布局验证脚本：桌面/移动端截图、主题、目录、搜索。

## 环境要求

- Node.js 18 或更高版本。
- 完整镜像与验证脚本需要本机安装 Edge 或 Chrome（`puppeteer-core` 复用系统浏览器）。

## 安装

```powershell
npm install
```

## 运行

```powershell
npm start
```

浏览器打开 <http://127.0.0.1:4173>。

也可以直接双击 `start-offline.cmd`，或在浏览器中打开 `index.html`。推荐使用本地
服务器，搜索和字体加载会更稳定。

端口和主机可通过环境变量覆盖：

```powershell
$env:PORT = "4173"
$env:HOST = "127.0.0.1"
npm start
```

## 完整离线镜像

```powershell
npm run sync
```

同步结果写入 `site/`（已加入 `.gitignore`），进度记录在 `offline-manifest.json`。
中断后再次运行会续传；同步完成后 `npm start` 会自动提供完整镜像。

可选环境变量：

```powershell
$env:SYNC_CONCURRENCY = "4"
$env:SYNC_REFRESH = "1"
npm run sync
```

源站当前有少量链接返回 404，清单会如实记录为不可用，不会伪造内容。

## 验证

```powershell
# 布局、主题、目录、搜索
npm test

# 审计镜像中的每个页面、图片、样式和引用
npm run test:offline
```

截图输出在 `qa/`（已加入 `.gitignore`）。

## 目录结构

```text
rezero-replica/
├─ index.html            # 复刻的首页
├─ book.js / searcher.js # mdBook 交互与搜索
├─ css/ theme/ fonts/    # 样式、主题和字体
├─ res/imgs/             # 首页插画与打赏二维码
├─ scripts/
│  ├─ sync-offline.js    # 全站镜像同步
│  ├─ verify.js          # 布局验证
│  ├─ verify-offline.js  # 镜像完整性审计
│  ├─ build-search-index.js
│  └─ capture.js         # 截图
├─ server.js             # 本地静态服务器
├─ package.json
└─ offline-manifest.json # 镜像清单
```

运行时目录 `site/`、`node_modules/`、`qa/` 不入库。

## 说明

- `package.json` 的许可证标记为 `UNLICENSED`。
- 打赏二维码来自原站（`res/imgs/donate/`），如不希望分发可自行删除，并同步调整
  `theme/donation-footer.js`。
- 本仓库只包含落地页与配套脚本，不包含完整的书籍正文镜像。

## 许可

站点内容与素材版权归原作者所有；本仓库不授予任何再分发许可。
