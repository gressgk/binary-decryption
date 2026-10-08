/* ==========================================================================
   dom.js — tiny DOM, formatting and download helpers shared by every view.
   ========================================================================== */
const $ = (selector, root = document) => root.querySelector(selector);

/** Escape text before putting it into an HTML string. */
const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const signed = Game.signed;

const Fmt = (() => {
  const pad = n => String(n).padStart(2, '0');
  const clock = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const date = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dateTime = ts => (ts ? `${date(ts)} ${clock(ts)}` : '—');
  const stamp = () => `${date(Date.now()).replace(/-/g, '')}-${clock(Date.now()).replace(/:/g, '')}`;
  const reward = amount => `+${amount / 1000}K`;
  const slug = text => text.replace(/[^\w-]+/g, '_');
  return { clock, date, dateTime, stamp, reward, slug };
})();

/** Save a text file through the browser's download mechanism. */
function download(filename, text) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}
