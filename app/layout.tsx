import "./globals.css";
import { ReactNode } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Naruto Sprite Fighters",
  description: "2D спрайтовый файтинг с героями Наруто: Наруто, Саске и Сакура."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
