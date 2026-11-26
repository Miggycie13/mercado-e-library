import { useState } from "react";

export function Cover({ title, category, coverUrl }: { title?: string; category: string; coverUrl?: string | null }) {
  const source = coverUrl && /^https?:\/\//i.test(coverUrl) ? coverUrl : "";
  const [failed, setFailed] = useState("");
  const photo = source && failed !== source;

  return (
    <div className={photo ? "cover has-photo" : "cover"}>
      {photo ? (
        <img className="cover-photo" src={source} alt={title || ""} onError={() => setFailed(source)} />
      ) : (
        <>
          <span>{category}</span>
          {title ? <strong>{title}</strong> : null}
        </>
      )}
    </div>
  );
}
