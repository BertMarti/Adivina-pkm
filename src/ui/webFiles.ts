export function downloadOnWeb(fileName: string, content: string, mime: string): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') return false;
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

export function pickTextFileOnWeb(
  maxBytes: number,
): Promise<{ ok: true; text: string; name: string } | { ok: false; error: string } | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,text/plain';
    input.style.display = 'none';
    document.body.appendChild(input);
    let settled = false;
    const finish = (result: { ok: true; text: string; name: string } | { ok: false; error: string } | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(result);
    };
    input.addEventListener('cancel', () => finish(null));
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      if (file.size > maxBytes)
        return finish({
          ok: false,
          error: 'El archivo es demasiado grande (más de 2 MB). Usa un JSON exportado desde PokéQuién.',
        });
      void file
        .text()
        .then((text) => finish({ ok: true, text, name: file.name }))
        .catch(() => finish({ ok: false, error: 'No se pudo leer el archivo.' }));
    });
    input.click();
  });
}
