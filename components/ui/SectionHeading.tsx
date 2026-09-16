export function SectionHeading({
  title,
  description,
  as: Tag = "h2",
}: {
  title: string;
  description?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className="mb-4">
      <Tag className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
        {title}
      </Tag>
      {description ? (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}
