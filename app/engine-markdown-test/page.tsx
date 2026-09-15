import { createPage } from "../../src/engine/createPage";

const NAS_MARKDOWN = [
	"# NAS layout",
	"",
	"For a configured storage root `<ROOT>` Cloud Node owns:",
	"",
	"```text",
	"<ROOT>/rbe/",
	"├── storage/",
	"│   └── <object-sha256>/",
	"│       ├── file.blob.cn | video.blob.cn | folder.blob.cn",
	"│       ├── versions/<content-sha256>/...",
	"│       └── chunks/<chunk-sha256>.chunk",
	"├── backup/",
	"└── recovery-staging/",
	"```",
	"",
	"```text <ROOT>/compact/ ├── storage/ └── backup/```",
	"",
	"| Capability | Result |",
	"| --- | --- |",
	"| Fenced code | Preserved |",
	"| Wide content | Scrollable |",
	"",
	"> The directory SHA is a stable object identity.",
	"",
	"- [x] CommonMark",
	"- [x] GitHub tables and task lists",
	"",
	"~~regex-only parser~~ AST-backed renderer",
	"",
	"[unsafe link](javascript:alert('nope'))",
	"",
	"<script data-engine-markdown-unsafe>window.__unsafe = true</script>",
].join("\n");

export default createPage({
	compiler: { pageId: "engine-markdown-test" },
	schema: {
		meta: { title: "EngineMarkdown server-first proof" },
		root: {
			type: "section",
			props: {
				contentMaxWidth: "72rem",
				px: "2rem",
				py: "2rem",
			},
			children: [{
				type: "markdown",
				name: "server-markdown",
				props: { content: NAS_MARKDOWN },
			}],
		},
	},
});
