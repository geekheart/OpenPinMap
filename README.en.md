[简体中文](README.md) | English

<div align="center">
  <img src="assets/favicon.svg" width="64" height="64" alt="OpenPinMap" />
  <h1>OpenPinMap</h1>
  <p><strong>A board pinout editor in your browser</strong></p>
  <p>A4 layouts · Drag-and-drop labels · PNG / SVG / JPG export</p>
  <p>
    <a href="https://geekheart.github.io/OpenPinMap/?lang=en"><strong>Open the workspace →</strong></a>
    &nbsp; · &nbsp;
    <a href="#quick-start">Run locally</a>
    &nbsp; · &nbsp;
    <a href="docs/deployment.md">Deployment guide (Chinese)</a>
    &nbsp; · &nbsp;
    <a href="https://github.com/geekheart/OpenPinMap/releases/latest/download/OpenPinMap.html" download>Offline HTML</a>
  </p>
  <p><code>Live preview</code> &nbsp; <code>Transparent PNG</code> &nbsp; <code>JSON projects</code> &nbsp; <code>Client-side</code></p>
</div>

![OpenPinMap v1.1 workspace, shown in Chinese](docs/images/overview.png)

Upload a front-view board image, set pin names, colors and spacing on either side, drag labels into alignment, and export a pinout diagram for a manual or product page.

The default example uses the transparent **WT9932P4-TINY** image and 54 pins arranged from the supplied P4 reference configuration. The S31 HDK example remains in `examples/s31.json`. Image and pin sources are documented in [Asset sources (Chinese)](docs/assets.md).

The interface defaults to Simplified Chinese. Choose **简体中文 / English** at the top right, or open [?lang=en](https://geekheart.github.io/OpenPinMap/?lang=en) for English. Switching changes only the interface: the current project, unapplied bulk text, pin names and group names are preserved. The adjacent GitHub icon opens the source repository. The offline HTML includes both languages and does not fetch language resources.

## Features

| Feature | Controls |
| --- | --- |
| Image processing | Upload or drop PNG / JPEG / WebP; trim transparent margins, position and scale the image, rotate by 0° / 90° / 180° / 270° |
| Multiple pin groups | Add groups and pins, edit names, individual colors, starting positions and spacing, enter names in bulk or reverse their order |
| Drag-to-layout editing | Select an image or PIN group; use corner handles for proportional scaling, top/bottom handles for group spacing, and drag with snapping |
| Label style | Font size, typeface, corner radius, leader lines, and GPIO / power / GND colors |
| A4 canvas | Portrait 210 × 297 mm or landscape 297 × 210 mm at 300 DPI, with custom pixel dimensions also available |
| Canvas navigation | Mouse wheel, trackpad pinch and two-finger zoom; drag blank space or hold Space while dragging to pan |
| Image export | Lossless transparent PNG, SVG vector labels, adjustable JPG quality, and live output dimensions and file size |
| Project files | Download JSON containing the image and all layout settings; import legacy Pins Studio projects |
| Drafts and history | Automatic local IndexedDB storage, up to 30 history states, undo / redo |
| Generator compatibility | Import pins_pic_gen configurations and export JSON plus a base image for the original generate.py |

Editing and export take place in the browser. User images and configurations are not uploaded; the hosting server supplies the application's static files. Clearing browser data deletes local drafts. Use **Save project** for long-term storage.

## From image to pinout

### 1. Place the image and set up the canvas

![Selected image with scale and rotation controls, shown in Chinese](docs/images/material-controls.png)

Click the board image to select it; a green outline indicates selection. Drag the image to move it, or drag a corner to scale it proportionally. The left panel provides X/Y positions and **0° / 90° / 180° / 270°** rotation. Rotation preserves the image center.

The default canvas is A4 portrait. Switch to landscape or custom dimensions as needed. Use the mouse wheel or trackpad pinch to zoom, and drag blank space or hold Space while dragging to pan. Transparent PNG / WebP images are best suited to layout; a transparent canvas does not remove white pixels from the photograph itself.

### 2. Edit and align a PIN group

![PIN group, resize handles and alignment controls, shown in Chinese](docs/images/pin-group-controls.png)

Click any label to select its PIN group, then drag to move the group. Corner handles scale text, labels and spacing together. Top/bottom middle handles change only pin spacing. The left panel supports names, colors, start positions, group scale, bulk name editing and reversing the order.

Set **Align to** to the board image, canvas or another PIN group, then choose Top, Center or Bottom. With **Snap to guides** enabled below the canvas, dragging close to an edge or center snaps the selection and displays a guide.

Display names, connector pin numbers and GPIO numbers are separate fields. The P4 example uses a front view with USB facing down, retaining original names such as IO9, IO6 and VO4. Verify the order against the actual engineering design; this general editor does not validate the electrical connections of a new board.

### 3. Choose an export format

![Export format, dimensions, quality and actual file size, shown in Chinese](docs/images/export-settings.png)

Click **Export image** at the top right. The screenshot shows **JPG, 50% output size and 90% image quality**. The left side previews the export, while the information below the settings shows its actual pixel dimensions and file size. Wait for the preview to finish after changing settings, then choose **Download file** or **Save as…**.

To continue editing later, use **Save project** to download JSON. It preserves the image, rotation, PIN group transformations and export settings.

## Export quality and compression

- **PNG** uses lossless encoding and retains alpha transparency. Selecting an output size such as 25%, 50% or 75% reduces file size. PNG has no lossy quality slider.
- **JPG** supports quality from 10% to 100%; transparent areas are composited on white. The quality percentage is not a fixed file-size compression ratio.
- **SVG** retains vector labels and leader lines, with the photograph embedded. Disable embedded-image compression to retain the original image, or re-encode it as WebP according to output size and quality. A photograph does not become a vector image.

The export dialog displays the actual file size. Selection boxes and snap guides are excluded. A4 PNG/JPG files include the corresponding DPI metadata: a 50% export is 150 DPI. SVG uses millimeter paper dimensions and the original-coordinate viewBox. Content outside the paper is clipped at the canvas boundary.

**Save as…** opens a system save dialog in browsers that support File System Access. **Download file** uses the standard browser download flow. Whether each download asks for a location depends on browser settings. See the [browser save API](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker) and [Canvas export quality](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob).

## Save and restore

- **Save project / Open project** includes the full image and settings for use across browsers and devices.
- **Import pins_pic_gen JSON** imports label configuration while keeping the current image as the base. A generator configuration alone does not contain the board image.
- **Generator files → Export config / Export base image** produces two files to place in the same directory for rendering with the original Python generator.

See [Project format (Chinese)](docs/project-format.md) for schema, coordinate conventions, limits and Python compatibility details.

Shortcuts: `Ctrl/⌘ Z` undoes, `Ctrl/⌘ Shift Z` redoes, and `Ctrl/⌘ S` saves the project. Text fields retain native browser editing shortcuts.

## Quick start

Use Node.js 24 or later:

```sh
git clone https://github.com/geekheart/OpenPinMap.git
cd OpenPinMap
npm ci
npm run dev
```

Open the URL shown in the terminal, normally <http://127.0.0.1:8766/OpenPinMap/>. After editing the source, run `npm run build` and refresh the page.

Building the static site alone does not require installing test dependencies:

```sh
node scripts/build.mjs
```

The build produces the `dist/` site and standalone `dist/OpenPinMap.html`. Double-click the standalone HTML to open it offline. The source `index.html` requires generated `defaults.js`; use the built directory for normal preview.

## Deployment

The repository uses [GitHub Actions](.github/workflows/pages.yml) for automated checks and publishing. Pushes to main and tags update Pages; pull requests run checks only. Relative resource paths support a repository subpath. See the [deployment guide (Chinese)](docs/deployment.md) for setup and `gh` verification commands.

You can also host `dist/` with any static hosting service. No server-side runtime is required.

## Development and verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover P4/S31 pin order, v1/v2 project compatibility, transforms, PNG/JPG DPI metadata, SVG escaping, translation catalog completeness, language/data isolation and static build paths. Browser tests cover canvas navigation, drag handles, project save/restore, import/export, JPG quality, SVG labels and mobile layout. Language regressions cover English controls and feedback, preservation of edited data, and offline English HTML. Actions retain screenshots and failure diagnostics; publishing follows successful checks.

```text
app.js                  Editor interactions, Canvas rendering and file operations
src/i18n.js             Chinese/English messages and explicit translation bindings
src/model.js            Project and pin configuration validation
src/export.js           DPI metadata and SVG escaping
style.css               Desktop and mobile layout
examples/p4.json        Default P4 A4 example
examples/s31.json       Preserved S31 HDK example
assets/                 Transparent board images and icons
scripts/                Static build and local server
tests/                  Data, build and browser regression tests
docs/                   Asset, format and deployment documentation
.github/workflows/      Automated checks and Pages publishing
```

There are no third-party runtime libraries. Playwright is a development test dependency, and Node.js is used only for building and development. The README structure and automated publishing approach follow [OpenBoxHub](https://github.com/geekheart/OpenBoxHub). See [AGENTS.md](AGENTS.md) for maintenance rules and [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance. Image and trademark ownership is described in [Asset sources (Chinese)](docs/assets.md).

## License

Project code and original documentation are available under the [MIT License](LICENSE), Copyright (c) 2026 geekheart. Third-party dependencies retain their own licenses. Product images, device marks and trademarks belong to their respective owners; MIT does not grant additional image or trademark rights for those assets. See [Asset sources (Chinese)](docs/assets.md) for attribution and scope.
