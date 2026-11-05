export function Cover({ title, category }: { title?: string; category: string }) {
  return (
    <div className="cover">
      <span>{category}</span>
      {title ? <strong>{title}</strong> : null}
    </div>
  );
}
