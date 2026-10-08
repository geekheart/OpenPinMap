# OpenPinMap development

- Keep the application fully client-side, with no runtime packages, analytics, server APIs or remote image uploads.
- Keep the interface concise. Put tutorials and implementation details in README/docs rather than helper paragraphs in the workspace.
- Keep transparency throughout image processing and PNG export. The preview checkerboard must never be exported.
- The default A4 example is `examples/p4.json` with the supplied transparent `assets/p4.webp`. Preserve its 54 pin names, order and colors.
- Preserve S31's verified pin order and metadata in `examples/s31.json`. Do not infer electrical functions from photographs.
- Preserve import compatibility with both `openpinmap` and legacy `pins-studio` version 1 projects.
- `assets/s31.webp` is a lossless conversion of the supplied transparent product photograph. Keep attribution in `docs/assets.md`.
- Never copy the user's complete HDK, schematic PDFs, local paths or unrelated workspace files into this repository.
- Keep the Pages build under relative URLs so `/OpenPinMap/` and offline standalone HTML both work.
- Run `npm test` and `npm run build`. For behavior changes, run browser tests or verify them in GitHub Actions. Inspect the deployed site after releases.
- Main and tags publish only after tests pass. Pull requests must never deploy. Keep workflow permissions scoped to each job.
- Do not hand-edit generated `dist/` or reintroduce self-descriptive marketing text into the editor.


## Languages and licensing

- Keep `README.md` in Simplified Chinese and `README.en.md` as its complete English counterpart, with mutual language links at the top. Update both when behavior, commands, limits or deployment instructions change.
- Project code and original documentation use the standard MIT license, `Copyright (c) 2026 geekheart`. Keep `package.json`, the root package-lock metadata and `LICENSE` consistent. Preserve dependency licenses and the asset/trademark scope documented in `docs/assets.md`.
- Default the interface to `zh-CN`; support `en` through the visible `#language-select` control and `?lang=en`. The options remain `简体中文` / `English` with values `zh-CN` / `en`.
- Use semantic keys in `src/i18n.js` and explicit `data-i18n` / `data-i18n-*` bindings. Do not scan text nodes or infer translations from rendered Chinese. Cover titles, metadata, panels, buttons, tooltips, accessible names, dynamic statuses, validation errors and export controls.
- A language change must preserve project state, image data, labels, connectors, unsaved batch text, transformations, selection and history. Never translate user data, JSON keys, electrical names, filenames or the original P4/S31 reference data. Language is UI state, not part of saved projects or IndexedDB design records.
- Include the same translation catalog in both the Pages build and standalone HTML; neither may fetch remote fonts, icons or translations. Keep the local SVG repository link at `#github-link` pointing to `https://github.com/geekheart/OpenPinMap`, with `target="_blank"` and `rel="noopener noreferrer"`.
- Add paired keys and matching interpolation placeholders for new messages. Validators retain stable message keys so an error can be shown in the current language. Test that switching languages does not change project schemas or pin metadata.
- For language changes, check both languages, all panels, accessible controls, export and invalid-import feedback, 390 px layout and the offline HTML. Node tests verify catalogs and data boundaries; browser tests verify actual DOM behavior. Do not claim unexecuted browser coverage as tested.
