export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.5rem] border-[1.5px] border-dashed border-[#1a1815]/35 bg-[#faf6ec]/60 px-8 py-16 text-center">
      <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-[#1a1815]">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[#3c362c]">
        {description}
      </p>
    </div>
  );
}
