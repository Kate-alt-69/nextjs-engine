## Server-resolved Markdown file

This small section is loaded from a local Markdown file through the documented `filePath` prop. The main feature tour above uses inline `content`, so this route covers both supported content-loading modes.

## Theme-inherited code block

The page selects a Markdown subtheme by ID; because this block has no local code colors, it inherits the theme defaults.

~~~typescript
const themeId: string = "emd-showcase.markdown.dark";
~~~
