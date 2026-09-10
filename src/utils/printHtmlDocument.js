// Print a standalone HTML document from the page the user is already on.
//
// The receipt/statement print paths used to be written twice: a hidden iframe in
// PrintReceiptDialog and Balance, and `window.open('', '_blank')` on the sell
// screen. The popup version put the browser's print dialog on top of a NEW tab
// holding the receipt, so the sell screen disappeared behind it and cancelling
// the print left that tab behind. A hidden iframe prints the same document with
// the print dialog over the current page and nothing else changing, which is
// what every caller wants — so they all come here now.
export function printHtmlDocument(html) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('title', 'Print');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  let done = false;
  const printFrame = () => {
    if (done) return;
    done = true;
    try {
      frame.contentWindow.focus();
      // Blocking in Chrome/Firefox/Edge (returns once the dialog is dismissed),
      // asynchronous in Safari — hence the delayed removal below rather than an
      // immediate one.
      frame.contentWindow.print();
    } catch (error) {
      console.error('Print failed:', error);
    }
    setTimeout(() => frame.remove(), 1000);
  };

  // Waiting for load matters: printing straight after document.write can catch
  // the frame before its styles and fonts are applied and emit a blank or
  // unstyled page.
  frame.onload = printFrame;

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Writing into an already-loaded about:blank frame does not fire `load` in
  // every browser; `done` keeps this from printing a second time when it does.
  setTimeout(printFrame, 500);
}

export default printHtmlDocument;
