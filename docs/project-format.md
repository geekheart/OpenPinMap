# 文件格式

## 完整项目

“保存项目”下载 `<名称>.openpinmap.json`，包含图片与排版，可直接通过“打开项目”恢复。

```json
{
  "format": "openpinmap",
  "version": 1,
  "state": {
    "name": "MyBoard",
    "width": 1200,
    "height": 1600,
    "background": "transparent",
    "fontSize": 36,
    "fontFamily": "Arial",
    "radius": 100,
    "guides": false,
    "imageX": 300,
    "imageY": 100,
    "imageScale": 100,
    "imageName": "board.png",
    "imageData": "data:image/png;base64,...",
    "palette": {"gpio": "#3498db", "power": "#e74c3c", "ground": "#2ecc71"},
    "groups": [{"connector": "H1", "start": [50,100], "gap": 70, "pins": [{"name":"GND", "color":"#2ecc71"}]}]
  }
}
```

示例中的 `imageData` 是占位符；实际项目必须包含可解码的 PNG、JPEG 或 WebP 数据。兼容旧版 `format: "pins-studio"`、`version: 1` 项目。

画布上限 8000 px / 边且总面积不超过 3200 万像素；最多 24 组、每组 300 针、合计 1000 针。坐标和间距均按原画布像素计算。预览缩放不改变输出尺寸。

## pins_pic_gen 配置

“引脚配置 → 导入 pins_pic_gen JSON”导入原生成器配置。它只含名称、颜色、字号、坐标与间距，不含图片；当前图片会保留并合成为底图。请搭配对应产品图使用。

“标签样式 → 生成器文件”分别导出配置和底图：

```sh
python3 /path/to/pins_pic_gen/generate.py MyBoard_pins.json
```

在配置和底图所在目录执行。文件名会自动配对为 `MyBoard.png` 与 `MyBoard_pins.json`。

页面使用 Canvas，原 Python 工具使用 Pillow，字体度量和抗锯齿可能存在细微差异。网页的自定义圆角、引线不会进入原生成器的标签配置；原脚本使用自己的胶囊样式。固定画布上越界的标签会阻止网页 PNG 导出，而原脚本可按自身规则扩展负 X 区域。
