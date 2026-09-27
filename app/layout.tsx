import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nutriverse — Know. Choose. Nourish.",
  description: "Personalized nutrition, food discovery and Calin Packs."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
