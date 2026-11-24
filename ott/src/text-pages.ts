export function textPages(text: string, size: number) {
  const pages: string[] = [];
  let remaining = text.replace(/\s+/g, ' ').trim();

  while (remaining.length > size) {
    const boundary = remaining.lastIndexOf(' ', size);
    const end = boundary >= size / 2 ? boundary : size;

    pages.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }

  if (remaining) pages.push(remaining);

  return pages;
}
