# Re:Zero mdBook 离线复刻

非官方的本地浏览项目，保留原 mdBook 首页的主题、目录和搜索界面。仓库包含轻量首页，完整镜像可按需同步。

## 运行首页

安装 Node.js 18+，在仓库根目录执行：

```powershell
npm start
```

访问 <http://127.0.0.1:4173>。未同步完整镜像时，服务会从 `public/` 提供首页及其资源。可通过 `PORT` 指定端口，或设置 `SERVE_ROOT=public` 始终查看仓库自带首页。

## 同步完整镜像

```powershell
npm run sync
npm start
```

同步写入 `site/`，并记录进度至 `offline-manifest.json`。如果同步中断，可沿用原命令继续。默认启动会优先使用已生成的 `site/`，Windows 上也可以用 `start-offline.cmd` 打开镜像。文件下载依赖原站仍可访问，完整性取决于同步结果。

## 源码与验证

| 路径 | 内容 |
| --- | --- |
| `public/index.html` | 自带首页 |
| `public/css/`、`public/theme/` | 页面样式和主题 |
| `public/fonts/`、`public/res/` | 字体和静态资源 |
| `public/searchindex.*` | 首页搜索索引 |
| `server.js` | 本地静态服务 |
| `scripts/` | 同步、构建索引、截图和检查 |

编辑首页后用 `npm run build:search` 更新轻量版搜索索引。浏览器验证需要用 `npm ci` 安装开发依赖，并安装脚本支持的本机 Edge 或 Chrome。之后可运行 `npm test`，完整镜像通过 `npm run test:offline` 检查。

原站内容、插图及打赏二维码归原作者或相关权利人所有。仓库标记为 `UNLICENSED`。原站首页见 [Re:Zero mdBook](https://re0zero.top/mdbook/book/index.html)。
