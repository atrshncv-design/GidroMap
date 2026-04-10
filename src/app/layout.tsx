import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Редактор карты гидроизогипс",
  description: "Интерактивный редактор карты гидроизогипс с расчетом изолиний, стрелок фильтрации и экспортом результата.",
  keywords: ["гидроизогипсы", "карта", "гидрогеология", "редактор", "изолинии", "интерполяция"],
  authors: [{ name: "GidroMap" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Редактор карты гидроизогипс",
    description: "Интерактивный редактор карты гидроизогипс",
    url: "/",
    siteName: "GidroMap",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Редактор карты гидроизогипс",
    description: "Интерактивный редактор карты гидроизогипс",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
