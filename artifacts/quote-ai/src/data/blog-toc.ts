export interface TocItem {
  level: 2 | 3;
  text: string;
  id: string;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àáâã]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõ]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function extractToc(contentHtml: string): TocItem[] {
  const items: TocItem[] = [];
  const regex = /<h([23])[^>]*>([\s\S]*?)<\/h[23]>/gi;
  let match;
  while ((match = regex.exec(contentHtml)) !== null) {
    const level = parseInt(match[1]) as 2 | 3;
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    const id = slugifyHeading(text);
    items.push({ level, text, id });
  }
  return items;
}

export function injectHeadingIds(contentHtml: string): string {
  return contentHtml.replace(/<h([23])>([\s\S]*?)<\/h[23]>/gi, (_, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    const id = slugifyHeading(text);
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
}
