const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export function emailPreviewDocument(format: string, body: string) {
  const inline = (value: string) => escapeHtml(value).replace(/\\([\\`*_{}\[\]()#+.!|>\-])/g, '$1').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const content = format === 'html' ? body : format === 'markdown'
    ? body.split('\n').map((line) => line.startsWith('## ') ? `<h2>${inline(line.slice(3))}</h2>` : line.startsWith('> ') ? `<blockquote>${inline(line.slice(2))}</blockquote>` : `<p>${inline(line)}</p>`).join('')
    : `<p style="white-space:pre-wrap">${escapeHtml(body)}</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>html{color-scheme:light}body{margin:0;padding:24px;background:#fffdf8;color:#213d30;font:15px/1.7 'PingFang SC','Microsoft YaHei',sans-serif;overflow-wrap:anywhere}*{box-sizing:border-box}img{max-width:100%}h2{font-size:21px}p{margin:0 0 14px}blockquote{margin:6px 0;padding:12px 16px;background:#eef4ed;border-radius:12px}table{max-width:100%}@media(max-width:400px){body{padding:16px}}</style></head><body>${content}</body></html>`;
}
