export function Cover({ title, category }: { title: string; category: string }) {
  return (
    <div className="cover">
      <span>{category}</span>
      <strong>{title}</strong>
    </div>
  );
}
