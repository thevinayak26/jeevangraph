import { proposeScan, type ScannedPage, type ScanProposal } from './scan-content';
import { uploadSizeAllowed } from './upload-limits';
export async function scanDocument(
  file: File,
  onProgress: (text: string) => void,
  signal: AbortSignal,
): Promise<ScanProposal> {
  if (!uploadSizeAllowed(file.size))
    throw new Error('Choose a non-empty PDF, PNG or JPEG up to 4 MB.');
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const pdf =
    header[0] === 37 &&
    header[1] === 80 &&
    header[2] === 68 &&
    header[3] === 70 &&
    header[4] === 45;
  const image =
    (header[0] === 137 && header[1] === 80 && header[2] === 78 && header[3] === 71) ||
    (header[0] === 255 && header[1] === 216 && header[2] === 255);
  if (!pdf && !image) throw new Error('File contents are not a supported PDF, PNG or JPEG.');
  const pages: ScannedPage[] = [];
  const ocr: { worker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>> | null } = {
    worker: null,
  };
  const check = () => {
    if (signal.aborted) throw new Error('Scan cancelled.');
  };
  async function recognize(input: File | HTMLCanvasElement, page: number) {
    check();
    onProgress(`Reading printed text on page ${page} locally…`);
    if (!ocr.worker) {
      const { createWorker } = await import('tesseract.js');
      ocr.worker = await createWorker('eng', 1, {
        workerPath: '/scan-assets/worker.min.js',
        corePath: '/scan-assets/core',
        langPath: '/scan-assets/lang',
        gzip: true,
        logger: (m) => {
          if (m.status === 'recognizing text')
            onProgress(`Reading page ${page}: ${Math.round(m.progress * 100)}%`);
        },
      });
    }
    check();
    const result = await ocr.worker!.recognize(input);
    check();
    return {
      page,
      text: result.data.text.slice(0, 30000),
      method: 'local_ocr' as const,
      confidence: Math.round(result.data.confidence),
    };
  }
  const abort = () => {
    void ocr.worker?.terminate().catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  let documentTask: ReturnType<typeof import('pdfjs-dist').getDocument> | null = null;
  try {
    if (pdf) {
      const library = await import('pdfjs-dist');
      library.GlobalWorkerOptions.workerSrc = '/scan-assets/pdf.worker.min.mjs';
      documentTask = library.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        useSystemFonts: true,
      });
      const doc = await documentTask.promise;
      check();
      if (doc.numPages > 6)
        throw new Error('Scan up to 6 pages per file. Split longer documents first.');
      for (let n = 1; n <= doc.numPages; n++) {
        check();
        onProgress(`Extracting page ${n} of ${doc.numPages}…`);
        const page = await doc.getPage(n);
        const text = await page.getTextContent();
        let lastY: number | null = null,
          lines = '';
        for (const item of text.items)
          if ('str' in item) {
            const y = item.transform[5];
            if (lastY !== null && Math.abs(lastY - y) > 4) lines += '\n';
            lines += item.str + (item.hasEOL ? '\n' : ' ');
            lastY = y;
          }
        if (lines.replace(/\s/g, '').length >= 40)
          pages.push({
            page: n,
            text: lines.slice(0, 30000),
            method: 'pdf_text',
            confidence: null,
          });
        else {
          const view = page.getViewport({
            scale: Math.min(
              2,
              1800 /
                Math.max(
                  page.getViewport({ scale: 1 }).width,
                  page.getViewport({ scale: 1 }).height,
                ),
            ),
          });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(view.width);
          canvas.height = Math.ceil(view.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas is unavailable. Use manual entry.');
          await page.render({ canvasContext: context, canvas, viewport: view }).promise;
          pages.push(await recognize(canvas, n));
          canvas.width = canvas.height = 0;
        }
        page.cleanup();
      }
    } else {
      const bitmap = await createImageBitmap(file);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 16_000_000)
        throw new Error(
          'Image is too large to scan safely on this device. Resize below 16 megapixels.',
        );
      pages.push(await recognize(file, 1));
    }
    check();
    if (!pages.some((p) => p.text.trim().length > 15))
      throw new Error(
        'No readable printed text found. Use a clearer scan or enter the fields manually.',
      );
    return proposeScan(pages, file.name);
  } finally {
    signal.removeEventListener('abort', abort);
    await ocr.worker?.terminate().catch(() => undefined);
    await documentTask?.destroy();
  }
}
