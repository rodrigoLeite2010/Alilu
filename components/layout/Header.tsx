import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { SiteNav } from "@/components/navigation/SiteNav";
import { SITE_NAME } from "@/lib/seo/site";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md text-lg font-bold tracking-tight text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Icon name="sparkles" className="h-5 w-5" />
          </span>
          {SITE_NAME}
        </Link>
        <SiteNav />
      </Container>
    </header>
  );
}
