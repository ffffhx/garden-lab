export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 px-8 py-16 text-center">
      <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-600">
        {description}
      </p>
    </div>
  );
}
