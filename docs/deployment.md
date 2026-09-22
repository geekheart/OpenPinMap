# 部署

## 本仓库的 GitHub Pages

地址：<https://geekheart.github.io/OpenPinMap/>

`.github/workflows/pages.yml` 在以下情况运行：

| 事件 | 行为 |
| --- | --- |
| PR 到 main | 数据校验、构建与浏览器测试，不发布 |
| push 到 main | 测试通过后发布 Pages |
| push 任意 tag | 测试通过后发布该 tag 对应版本 |
| workflow_dispatch | 所选 main 或 tag 通过检查后发布；其他分支只检查 |

生产发布共用并发组，不中断正在进行的部署。构建任务仅有代码读取权限；发布任务独立授予 `pages: write` 与 `id-token: write`。

## 发布新版本

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e

git tag -a v1.1.1 -m "OpenPinMap v1.1.1"
git push origin main v1.1.1
gh run list --workflow pages.yml
gh run watch <run-id> --exit-status
```

推送 main 也会更新在线站点。版本标签对应的提交必须包含发布 workflow；标签只在本地创建而未推送时不会触发发布。

## Fork / 新仓库

1. 将仓库复制到自己的 GitHub 账号。
2. Settings → Pages → Build and deployment 中选择 GitHub Actions。
3. Settings → Environments → github-pages 的部署规则允许 `main` 分支以及标签 `*` 和 `**/*`。
4. 启用 Actions，推送 main 或手动执行 `pages.yml`。
5. 在 Actions 确认成功，从 Settings → Pages 打开站点。

参考：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 其他静态服务器

```sh
npm run build
```

上传 `dist/` 全部内容即可，无需 Node.js 后端。`dist/OpenPinMap.html` 是含图片与脚本的单文件版本，可以离线打开。原始源目录的 `index.html` 需先构建，不是独立文件。
