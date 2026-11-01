# 最终交付 · 2026-11-01

本轮开发已完成。README 提供制作流程、三种摄影场景、手机界面和作品卡的图文说明。

| 交付 | 文件 | 大小 |
| --- | --- | --- |
| 懂了鸭平台单 HTML | `platform/index.html` | 9,218,042 字节 |
| 完整离线单 HTML | `dist/pottery-studio.html` | 33,249,858 字节 |

本次复核釉面算法与烧成计时测试通过，两份 HTML 的 SHA-256 与上次交付一致。已有平台审计及浏览器验证报告见 `docs/verification/`，详细适配说明见 `docs/platform-delivery.md`。

完成收尾整理，保留源码、美术源工程、设计参考、展示截图、验证摘要和交付文件。可再生测试中间产物、日志和自动备份不纳入交付。重建命令：

```sh
npm run build:single
npm run prepare:platform
npm run build:platform
```
