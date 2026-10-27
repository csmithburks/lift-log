// Browser / home-screen-app version of file import and export.

export function pickTextFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json,.txt,text/csv,application/json,text/plain';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return resolve(null);
      resolve({ name: file.name, text: await file.text() });
    };
    document.body.appendChild(input);
    input.click();
  });
}

export async function shareTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const file = new window.File([blob], filename, { type: mimeType });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
