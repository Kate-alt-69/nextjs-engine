import { createPage, EngineSEOJsonLd } from "@/src/engine";
import { engineSEOTest, engineSEOTestSchema } from "./seo";

const EngineSEOProofPage = createPage(engineSEOTestSchema);

export const generateMetadata = engineSEOTest.generateMetadata;

export default async function Page() {
	return (
		<>
			<EngineSEOProofPage />
			<EngineSEOJsonLd data={await engineSEOTest.jsonLd()} />
		</>
	);
}
