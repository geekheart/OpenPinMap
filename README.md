<div align="center">
  <img src="assets/favicon.svg" width="64" height="64" alt="OpenPinMap" />
  <h1>OpenPinMap</h1>
  <p><strong>浏览器里的开发板引脚图编辑器</strong></p>
  <p>放入产品图 · 标注引脚 · 导出 PNG</p>
  <p>
    <a href="https://geekheart.github.io/OpenPinMap/"><strong>打开在线工作台 →</strong></a>
    &nbsp; · &nbsp;
    <a href="#快速开始">本地运行</a>
    &nbsp; · &nbsp;
    <a href="docs/deployment.md">部署指南</a>
    &nbsp; · &nbsp;
    <a href="https://geekheart.github.io/OpenPinMap/OpenPinMap.html" download>离线单文件</a>
  </p>
  <p><code>实时预览</code> &nbsp; <code>透明 PNG</code> &nbsp; <code>JSON 配置</code> &nbsp; <code>纯前端</code></p>
</div>

上传开发板的正面产品图，设置两侧引脚名称、颜色与间距，拖动标签对齐焊孔，再导出可用于手册或产品页的引脚图。

内置 **WT9932S31-TINY** 示例：透明底产品照片、42 个引脚，配置依据 HDK 2026-09-20。图片与引脚来源见[素材说明](docs/assets.md)。界面只保留编辑控件，说明集中在本文档。

## 可以做什么

| 功能 | 操作 |
| --- | --- |
| 图片处理 | 上传或拖入 PNG / JPEG / WebP；裁去透明边缘，调整位置与缩放 |
| 多组引脚 | 新增分组和引脚，编辑名称、单针颜色、起点与间距，批量录入或反转顺序 |
| 直接定位 | 在预览中拖动图片，或拖动任意标签移动整组 |
| 标签样式 | 字号、字体、圆角、引线和 GPIO / 电源 / GND 配色 |
| 画布预览 | 透明、白色、深色背景；适应画布、缩放与 100% 查看 |
| PNG 导出 | 按画布原尺寸输出，透明模式保留 alpha，棋盘格不进入文件 |
| 项目保存 | 下载包含图片和全部排版设置的 JSON；支持旧 Pins Studio 项目 |
| 草稿与历史 | IndexedDB 本机自动保存，最多 30 个历史状态，撤销 / 重做 |
| 生成器兼容 | 导入 pins_pic_gen 配置，导出可供原 generate.py 使用的 JSON 和底图 |

编辑和导出在浏览器中完成，不上传用户图片或配置。网站自身的静态文件由托管服务器提供。清理浏览器数据会删除本机草稿，需要长期保留时使用“保存项目”。

## 从图片到引脚图

1. 在“素材与画布”更换产品图片。透明底 PNG / WebP 更适合排版；照片本身有白底时，选择透明画布不会自动抠图。
2. 在“引脚配置”选中分组，填写每针名称与颜色；批量编辑支持每行一个名称。
3. 调整起点 X/Y、针脚间距，或拖动标签移动整组。对照照片和实际工程核验顺序。
4. 在“标签样式”修改字号、圆角和配色，点击“导出 PNG”。

显示名称、连接器针号与 GPIO 编号是不同字段。内置 S31 图以正面观察、USB 朝下，H1 从上到下为 1→21，H2 为 21→1。通用编辑器不会验证新开发板的电气连接。

## 保存与恢复

- **保存项目 / 打开项目**：完整图片与参数，跨浏览器、跨设备恢复。
- **导入 pins_pic_gen JSON**：只导入标签配置，当前图片保留为底图；配置本身不含产品图片。
- **生成器文件 → 导出配置 / 导出底图**：将两份文件放在同一目录，使用原 Python 生成器重新绘制。

格式、坐标约定、限制和 Python 兼容细节见[文件格式](docs/project-format.md)。

快捷键：`Ctrl/⌘ Z` 撤销，`Ctrl/⌘ Shift Z` 重做，`Ctrl/⌘ S` 保存项目；输入框内保留浏览器原生编辑快捷键。

## 快速开始

使用 Node.js 24 或更高版本：

```sh
git clone https://github.com/geekheart/OpenPinMap.git
cd OpenPinMap
npm ci
npm run dev
```

打开终端中的地址，默认 <http://127.0.0.1:8766/OpenPinMap/>。修改代码后运行 `npm run build` 并刷新页面。

仅构建静态页面不需要安装测试依赖：

```sh
node scripts/build.mjs
```

构建得到 `dist/` 网站和 `dist/OpenPinMap.html` 离线单文件。独立 HTML 可直接双击打开；源目录 `index.html` 需要生成 `defaults.js` 后才能使用，请通过构建后的目录访问。

## 部署

本仓库使用 [GitHub Actions](.github/workflows/pages.yml) 自动测试与发布：main 提交和标签推送触发 Pages 更新，PR 只执行检查。发布时采用相对资源路径，支持仓库子路径。完整步骤与 `gh` 检查命令见[部署指南](docs/deployment.md)。

也可以将 `dist/` 上传到任意静态托管服务，无需服务端运行环境。

## 开发与验证

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

单元测试覆盖 S31 引脚顺序、项目格式兼容、参数边界、无效输入和静态构建路径。浏览器测试覆盖实时编辑、撤销重做、图片和配置导入、项目保存恢复、实际 PNG 尺寸与透明像素、移动端布局。Actions 中保留截图和失败诊断；测试通过后才发布。

```text
app.js                  编辑交互、Canvas 渲染与文件操作
src/model.js            项目及引脚配置校验
style.css               桌面与移动端布局
examples/s31.json       S31 示例配置
assets/                 透明产品素材与图标
scripts/                静态构建、本地服务器
tests/                  数据、构建及浏览器回归测试
docs/                   素材、格式与部署说明
.github/workflows/      自动检查与 Pages 发布
```

页面不使用运行时第三方库。Playwright 是开发测试依赖；Node.js 仅用于构建与开发。README 组织和自动发布方式参考 [OpenBoxHub](https://github.com/geekheart/OpenBoxHub)。开发约定见 [AGENTS.md](AGENTS.md)，参与方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。产品图片及商标归属见[素材说明](docs/assets.md)。
