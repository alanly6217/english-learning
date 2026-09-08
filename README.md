# english.alanly.cn

独立 PWA 英语学习站。与 Alan AI 项目完全无关。

## 文件
- index.html：100篇正文全部内嵌，不依赖 API / 数据库
- manifest.webmanifest：iPhone 主屏幕应用信息
- sw.js：离线缓存和版本更新
- icon-192.png / icon-512.png / apple-touch-icon.png：应用图标

## 使用
部署到任意 HTTPS 静态网站后，将 english.alanly.cn 指向该站点。
iPhone Safari 第一次联网打开，等待页面显示“离线缓存已启用”，再点分享 → 添加到主屏幕。
之后可断网打开阅读。

## 隔离原则
不要放进 Alan AI 仓库；不要修改 alanly.cn 主站；不要连接 Alan AI API 或数据库。
