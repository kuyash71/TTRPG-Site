/** HTML'i ilk başlıktan (h2/h3/h4) önceki giriş ve geri kalanı olarak ikiye ayırır. */
export function splitLead(html: string): [string, string] {
  const i = html.search(/<h[234][\s>]/);
  return i < 0 ? [html, ""] : [html.slice(0, i).trim(), html.slice(i).trim()];
}
