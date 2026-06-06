import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "Next.js Engine",
	description: "Schema-driven rendering engine for Next.js",
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
