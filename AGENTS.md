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
