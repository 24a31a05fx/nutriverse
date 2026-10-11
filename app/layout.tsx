import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#163d2c",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://nutriverse.in"),
  title: "Nutriverse — Don't Just Eat. Understand Your Nutrition.",
  description:
    "Nutriverse is a nutrition-first grocery platform helping people understand their nutritional needs with smart food discovery and convenient Calin Packs.",
  keywords: [
    "nutrition grocery",
    "Calin Packs",
    "personalized nutrition",
    "healthy food bundles",
    "food nutrient discovery",
    "balanced meals",
    "Nutriverse"
  ],
  authors: [{ name: "Nutriverse Team" }],
  openGraph: {
    title: "Nutriverse — Don't Just Eat. Understand Your Nutrition.",
    description:
      "A smarter way to choose food: nutrition-focused groceries, AI-assisted recommendations, and curated Calin Packs.",
    url: "https://nutriverse.in",
    siteName: "Nutriverse",
    images: [
      {
        url: "/assets/hero-food.jpg",
        width: 1200,
        height: 630,
        alt: "Nutriverse Nutrition-First Grocery Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nutriverse — Don't Just Eat. Understand Your Nutrition.",
    description:
      "A smarter way to choose food: nutrition-focused groceries, AI-assisted recommendations, and curated Calin Packs.",
    images: ["/assets/hero-food.jpg"],
  },
  icons: {
    icon: "/assets/nutriverse-logo.jpeg",
    apple: "/assets/nutriverse-logo.jpeg",
  },
};

import { NutriverseProvider } from "@/components/NutriverseProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NutriverseProvider>{children}</NutriverseProvider>
      </body>
    </html>
  );
}