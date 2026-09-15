import { EngineMarkdown } from "../../src/engine/components/EngineMarkdown";

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

export default function EngineMarkdownTestPage() {
	return (
		<main style={{ margin: "0 auto", maxWidth: "72rem", padding: "2rem", minWidth: 0 }}>
			<EngineMarkdown content={NAS_MARKDOWN} />
		</main>
	);
}
