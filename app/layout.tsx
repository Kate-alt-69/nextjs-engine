import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
	title: "",
	description: "",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<head>
				{/* Engine theme will inject additional styles */}
			</head>
			<body>
				{children}
			</body>
		</html>
	);
}
