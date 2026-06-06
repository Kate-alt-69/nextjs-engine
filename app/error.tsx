"use client";
import { createPage, defineSchema } from "@/engine";
import { useEffect } from "react";

const ErrorSchema = (error: Error) => defineSchema({
	theme: {
		vars: {
			"--e-accent":       "#f97316",
			"--e-bg":           "#0f0f1a",
			"--e-card-bg":      "#1a1a2e",
			"--e-divider":      "rgba(255,255,255,0.08)",
			"--e-muted":        "#94a3b8",
			"--e-skeleton-a":   "#1e1e35",
			"--e-skeleton-b":   "#2a2a45",
		},
		fonts: [
			"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
		],
		globalStyles: `
			*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
			html { scroll-behavior: smooth; }
			body { background: var(--e-bg); color: #e2e8f0; font-family: 'Inter', sans-serif; }
		`,
	},
	root: {
		type: "section",
		props: {
			fullViewport: true,
			contentMaxWidth: "700px",
			bg: "linear-gradient(135deg, #0f0f1a 0%, #3d1a0f 100%)",
		},
		children: [
			{
				type: "stack",
				props: {
					direction: "vertical",
					gap: "2rem",
					align: "center",
					justify: "center",
				},
				children: [
					{
						type: "text",
						props: {
							variant: "h1",
							content: "⚠️",
							fontSize: "4rem",
						},
					},
					{
						type: "heading",
						props: {
							level: 2,
							content: "Something Went Wrong",
							subheading: "An unexpected error occurred while rendering this page.",
							align: "center",
						},
					},
					{
						type: "card",
						props: {
							variant: "filled",
							p: "1.5rem",
							bg: "rgba(0,0,0,0.4)",
						},
						children: [
							{
								type: "text",
								props: {
									variant: "caption",
									content: "Error Details",
									color: "var(--e-accent)",
									mb: "0.5rem",
									weight: "600",
								},
							},
							{
								type: "text",
								props: {
									variant: "body-sm",
									content: error?.message || "Unknown error occurred",
									color: "var(--e-muted)",
									fontFamily: "monospace",
									fontSize: "0.8rem",
									truncate: 5,
								},
							},
						],
					},
					{
						type: "stack",
						props: {
							direction: "horizontal",
							gap: "1rem",
							justify: "center",
							wrap: true,
						},
						children: [
							{
								type: "button",
								props: {
									label: "Try Again",
									variant: "solid",
									size: "lg",
									onClick: "reload",
								},
							},
							{
								type: "button",
								props: {
									label: "Go Home",
									variant: "outline",
									size: "lg",
									href: "/",
								},
							},
						],
					},
					{
						type: "text",
						props: {
							variant: "caption",
							content: "The error has been logged. Our team has been notified.",
							align: "center",
							color: "var(--e-muted)",
						},
					},
				],
			},
		],
	},
});

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log the error to an error reporting service
		console.error("Page error:", error);
	}, [error]);

	const Page = createPage({
		schema: ErrorSchema(error),
		handlers: {
			reload: reset,
		},
	});

	return <Page />;
}
