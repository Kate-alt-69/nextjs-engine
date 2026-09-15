import { createPage } from "../../../../src/engine/createPage";

export default createPage({
	compiler: { pageId: "/engine-compat-test/browser-dialog/fallback" },
	schema: {
		meta: { title: "Generation 3 compatibility fallback proof" },
		root: {
			type: "grid",
			props: { columns: 1, p: "2rem" },
			children: [
				{
					type: "heading",
					props: { level: 1, content: "Reasonable fallback available" },
				},
				{
					type: "link",
					props: {
						href: "/engine-compat-test/browser-dialog",
						content: "Open blocking-feature proof",
						transition: "fade",
					},
				},
			],
		},
	},
});
