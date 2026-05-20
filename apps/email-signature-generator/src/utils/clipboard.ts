export async function copyRichText(html: string): Promise<boolean> {
  try {
    const blob = new Blob([html], { type: "text/html" });
    const item = new ClipboardItem({ "text/html": blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return legacyCopy(html);
  }
}

export async function copyHtmlCode(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function legacyCopy(html: string): boolean {
  try {
    const div = document.createElement("div");
    div.innerHTML = html;
    div.style.cssText = "position:absolute;left:-9999px;top:-9999px;";
    document.body.appendChild(div);
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("copy");
    sel.removeAllRanges();
    document.body.removeChild(div);
    return true;
  } catch {
    return false;
  }
}
