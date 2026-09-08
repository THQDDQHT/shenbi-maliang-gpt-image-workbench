# 啟画部署

React 静态页面和 Bun API 运行于一个容器。全新数据保存在 `qihua_qihua-data` 卷，包含两个 SQLite 数据库和图片文件。不要挂载旧站数据库。

## 构建与镜像发布

`bun install --frozen-lockfile && bun run build`；测试命令 `bun test`。
GitHub Actions 的 Container 工作流在 main 推送、v 开头标签或手动触发时发布 linux/amd64 镜像到 `ghcr.io/thqddqht/shenbi-maliang-gpt-image-workbench`。
PR 只构建，不发布。主分支有 latest 标签，每个镜像还有完整 `sha-<commit>` 标签；部署优先使用工作流摘要中的 digest。

## 固定服务器

- SSH：`q2qs@139.196.98.1:50022`
- 目录：`~/projects/shenbi-maliang-gpt-image-workbench`
- 外部网络：`cliproxyapi_cpa-network`，CPA 为 `http://cli-proxy-api:8317`
- 私有预览：`127.0.0.1:8787`
- 生产入口：`192.168.31.28:7777`，现有 Tunnel 的 `qixianghua.q2qs.top` 指向此端口

服务器维护权限为 600 的 `.env.production`，仅需 `GPT_IMAGE_API_KEY`（CPA 访问密钥）、`APP_PUBLIC_URL=https://qixianghua.q2qs.top`。不要把本机环境文件上传到服务器。
镜像引用通过 Compose 的 `--env-file .env.production` 读取 `QIHUA_IMAGE`，可选；未设置时本机构建 qihua:local。

初次部署锁定 Git SHA，先执行：

```sh
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

在私有预览阶段，通过服务器生成的 `QIHUA_INITIAL_PASSWORD` 环境变量运行 `bun scripts/provision-qihua.ts`。该脚本只允许首次初始化，创建后台密码、torchz 用户和单一 CPA 兼容 API 渠道；不打印密码。首次密码由服务器单独保管，不加入长期容器环境。

确认 `/api/health`、登录、品牌、生成、编辑及图片持久化后切换。旧 Web 容器占用 7777，需先停止 `infinite-canvas-public-web-1`，再执行：

```sh
docker compose --env-file .env.production -f compose.yaml -f compose.production.yaml up -d --no-build
```

切换期间入口会短暂不可用。旧 API、worker、数据库及容器均保留；不要执行 down 或删除 volume。新增数据库在新卷中由项目启动逻辑自动初始化，不执行旧数据库迁移。

使用已发布镜像时先设置 QIHUA_IMAGE 到 digest，执行 pull，再 up -d --no-build。回退需要明确授权：停止新 Web，再启动保留的旧 Web；不自动回滚。

## 验收与备份

检查 Compose 服务 healthy、Git SHA、最近日志和公网 `/api/health`。测试登录、生图、编辑、切页恢复、重启后图片读取。保留服务端备份功能；SQLite 在线备份使用应用备份接口，不直接复制写入中的数据库文件。完整备份须覆盖 data 下全部文件。

初期关闭自助注册、邮件、短信、CPA 账号同步和每日自动文案。后台高级设置保留，默认只显示常用配置。客户端安装入口关闭，此精简容器不包含 ChatGPT Web 的 Python 桥接运行环境。
