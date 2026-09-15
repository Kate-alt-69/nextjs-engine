import { createPage } from "../../../src/engine/createPage";

export default createPage({
	compiler: { pageId: "/engine-compat-test/browser-dialog" },
	schema: {
		meta: { title: "Generation 3 compatibility dialog proof" },
		root: {
			type: "box",
			props: { p: "2rem" },
			children: [
				{
					type: "heading",
					props: { level: 1, content: "Browser compatibility dialog proof" },
				},
				{
					type: "canvas",
					props: {
						mode: "webgl2",
						onDraw: "compatibilityProof",
						height: "180px",
					},
				},
			],
		},
	},
});
