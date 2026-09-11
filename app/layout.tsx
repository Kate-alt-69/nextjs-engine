import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: {
    default: "Roavio · Digital nomad destinations",
    template: "%s · Roavio"
  },
  description: "Compare global destinations for remote work using cost, connectivity, safety, quality of life and relocation context.",
  applicationName: "Roavio",
  themeColor: "#f5f4ee"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body>{children}</body>
    </html>
  );
}
