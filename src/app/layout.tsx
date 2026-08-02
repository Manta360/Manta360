import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";

const fontFallbacks = {
  "--font-manrope": "Arial, Helvetica, sans-serif",
  "--font-fraunces": "Georgia, 'Times New Roman', serif",
} as CSSProperties;

export const metadata: Metadata = {
  title: "Manta360",
  description:
    "Plataforma habitacional de Manta: catálogo, contratos y supervisión municipal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased" style={fontFallbacks}>
        {children}
      </body>
    </html>
  );
}
