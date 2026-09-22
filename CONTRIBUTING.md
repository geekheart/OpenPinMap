# 参与开发

使用 Node.js 24 或更高版本：

```sh
npm ci
npm run dev
```

页面位于 http://127.0.0.1:8766/OpenPinMap/ 。开发服务器提供 `dist/`，修改源码后重新运行 `npm run build` 并刷新浏览器。

提交前运行：

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

PR 请写明用户遇到的问题、改动后的行为和验证结果。涉及布局或图片处理时附上截图；涉及透明 PNG 时检查实际导出文件的 alpha 通道。新增示例要写明来源、视角与针脚顺序，保留素材归属。

应用没有运行时依赖。开发依赖仅用于浏览器测试，请维护 `package-lock.json`，不要提交 `node_modules/`、`dist/` 或本机草稿。
