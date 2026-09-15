import { createEngineSEOImageResponse } from "@/src/engine/seo";
import { engineSEOTest } from "./seo";

export const alt = "EngineSEO proof";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
	return createEngineSEOImageResponse(await engineSEOTest.resolve(), size);
}
