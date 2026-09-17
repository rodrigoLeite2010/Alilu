import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { SiteNav } from "@/components/navigation/SiteNav";
import { SITE_NAME } from "@/lib/seo/site";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur print:hidden">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md text-base font-semibold tracking-tight text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-white">
            <Icon name="wrench" className="h-4 w-4" />
          </span>
          {SITE_NAME}
        </Link>
        <SiteNav />
      </Container>
    </header>
  );
}
