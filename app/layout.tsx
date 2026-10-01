import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LogoutNotice } from "@/components/layout/LogoutNotice";
import { SuggestionPrompt } from "@/components/layout/SuggestionPrompt";
import { SiteSidebar } from "@/components/navigation/SiteNav";
import { DonationProvider } from "@/components/donation/DonationProvider";
import { DonationFloatingButton } from "@/components/donation/DonationFloatingButton";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE_TEMPLATE, SITE_URL } from "@/lib/seo/site";

/**
 * Publisher ID oficial do Google AdSense para o alilu.com.br. Único lugar do
 * projeto onde este ID deve existir — não duplicar em nenhum outro arquivo.
 * Ainda não há anúncios reais nesta fase (PROMPT MESTRE, seção 11): esta tag
 * serve apenas para verificação de propriedade do domínio e solicitação de
 * revisão junto ao Google AdSense.
 */
const ADSENSE_PUBLISHER_ID = "ca-pub-2601584178688625";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Calculadoras e ferramentas online gratuitas`,
    template: SITE_TITLE_TEMPLATE,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#004b5a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Suspense fallback={null}>
          <LogoutNotice />
        </Suspense>
        {/*
          Script oficial de verificação do Google AdSense. `strategy="beforeInteractive"`
          garante que o Next.js injete esta tag dentro do <head> do HTML
          gerado (documentado em next/script: "Scripts with beforeInteractive
          will always be injected inside the head of the HTML document
          regardless of where it's placed in the component"), carregada uma
          única vez por documento em todas as páginas do site, já que este é
          o layout raiz. Nenhum anúncio real é criado aqui — só a tag de
          verificação/revisão.
        */}
        <Script
          id="google-adsense-account"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        <DonationProvider>
          <Header />
          <div className="flex min-h-0 flex-1">
            <SiteSidebar />
            <main className="min-w-0 flex-1">{children}</main>
          </div>
          {/*
            Pilha de widgets flutuantes do canto inferior direito: cada um
            empurra o outro para cima em vez de se sobrepor (ver nota em
            SuggestionPrompt.tsx). DonationFloatingButton some sozinho
            quando a doação está desabilitada (DonationButton -> useDonation).
          */}
          <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 print:hidden">
            <DonationFloatingButton />
            <SuggestionPrompt />
          </div>
          <Footer />
        </DonationProvider>
      </body>
    </html>
  );
}
