import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { createVatReport, downloadVatReport, VatApiError } from "./api";
import type { ApiError, VatReport } from "./types";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const moneyFormatter = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "HUF",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function formatFileSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function Icon({ name }: { name: "upload" | "file" | "download" | "check" | "close" | "arrow" }) {
  const paths = {
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <><path d="m7 7 10 10"/><path d="m17 7-10 10"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>
  };

  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<VatReport | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  function selectFile(nextFile?: File) {
    setReport(null);
    setError(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!nextFile.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError({ title: "Please select a CSV file." });
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError({ title: "The CSV file must be 2 MB or smaller." });
      return;
    }

    setFile(nextFile);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  async function loadSample() {
    setError(null);
    try {
      const response = await fetch("/sample-invoices.csv");
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      selectFile(new File([blob], "sample-invoices.csv", { type: "text/csv" }));
    } catch {
      setError({ title: "The sample file could not be loaded." });
    }
  }

  async function processFile() {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setReport(null);

    try {
      setReport(await createVatReport(file));
    } catch (caught) {
      setError(caught instanceof VatApiError
        ? caught.details
        : { title: "The service is unavailable. Please try again." });
    } finally {
      setIsProcessing(false);
    }
  }

  async function downloadPdf() {
    if (!file) return;
    setIsDownloading(true);
    setError(null);
    try {
      await downloadVatReport(file);
    } catch (caught) {
      setError(caught instanceof VatApiError
        ? caught.details
        : { title: "The PDF could not be downloaded. Please try again." });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Tax Desk VAT home">
          <span className="brand-mark">T<span>D</span></span>
          <span className="brand-name">Tax Desk</span>
        </a>
        <div className="environment"><span /> Secure processing</div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="eyebrow">Hungarian VAT · ÁFA</div>
          <h1>Turn invoice data into a<br/><em>clear VAT summary.</em></h1>
          <p>Upload a CSV to validate transactions, calculate totals by Hungarian VAT category, and export a ready-to-review PDF.</p>
        </section>

        <section className="workspace" aria-labelledby="upload-heading">
          <div className="section-heading">
            <div><span className="step">01</span><h2 id="upload-heading">Upload source data</h2></div>
            <button className="text-button" type="button" onClick={loadSample}>Use sample data <Icon name="arrow" /></button>
          </div>

          {!file ? (
            <div
              className={`dropzone ${isDragging ? "is-dragging" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
              role="button"
              tabIndex={0}
            >
              <div className="upload-icon"><Icon name="upload" /></div>
              <strong>Drop your invoice CSV here</strong>
              <span>or click to browse from your computer</span>
              <small>CSV only · Maximum 2 MB · Up to 10,000 rows</small>
            </div>
          ) : (
            <div className="selected-file">
              <div className="file-icon"><Icon name="file" /></div>
              <div className="file-details"><strong>{file.name}</strong><span>{formatFileSize(file.size)} · Ready to process</span></div>
              <span className="ready-badge"><Icon name="check" /> Ready</span>
              <button className="icon-button" type="button" onClick={() => selectFile()} aria-label="Remove selected file"><Icon name="close" /></button>
            </div>
          )}

          <input ref={inputRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={onInputChange} />

          <div className="schema-note">
            <strong>Expected columns</strong>
            <code>invoiceNumber</code><code>date</code><code>netAmount</code><code>vatRate</code>
            <span>Rates: 0%, 5%, 18%, 27%</span>
          </div>

          {error && (
            <div className="error-panel" role="alert">
              <strong>{error.title}</strong>
              {error.errors && error.errors.length > 0 && (
                <ul>{error.errors.map((item, index) => <li key={`${item.row}-${item.field}-${index}`}><b>{item.row ? `Row ${item.row}` : "File"} · {item.field}</b> — {item.message}</li>)}</ul>
              )}
            </div>
          )}

          <button className="primary-button" type="button" disabled={!file || isProcessing} onClick={processFile}>
            {isProcessing ? <><span className="spinner" /> Processing securely…</> : <>Generate VAT summary <Icon name="arrow" /></>}
          </button>
        </section>

        {report && (
          <section className="results" aria-labelledby="results-heading">
            <div className="section-heading results-heading">
              <div><span className="step">02</span><h2 id="results-heading">Declaration summary</h2></div>
              <div className="report-meta"><b>{report.transactionCount} transactions</b><span>{formatDate(report.dateFrom)} – {formatDate(report.dateTo)}</span></div>
            </div>

            <div className="summary-cards">
              <article><span>Total net</span><strong>{formatMoney(report.totals.netAmount)}</strong></article>
              <article><span>VAT payable</span><strong>{formatMoney(report.totals.vatAmount)}</strong></article>
              <article className="accent-card"><span>Total gross</span><strong>{formatMoney(report.totals.grossAmount)}</strong></article>
            </div>

            <div className="table-wrap">
              <table>
                <caption>Totals grouped by VAT category</caption>
                <thead><tr><th>VAT category</th><th>Transactions</th><th>Net amount</th><th>VAT amount</th><th>Gross amount</th></tr></thead>
                <tbody>
                  {report.categories.map((category) => (
                    <tr key={category.vatRate}>
                      <td><span className="rate-pill">{category.vatRate}% ÁFA</span></td>
                      <td>{category.transactionCount}</td>
                      <td>{formatMoney(category.netAmount)}</td>
                      <td>{formatMoney(category.vatAmount)}</td>
                      <td>{formatMoney(category.grossAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><th>Total</th><td>{report.transactionCount}</td><td>{formatMoney(report.totals.netAmount)}</td><td>{formatMoney(report.totals.vatAmount)}</td><td>{formatMoney(report.totals.grossAmount)}</td></tr></tfoot>
              </table>
            </div>

            <div className="result-actions">
              <div><strong>Report validated</strong><span>Calculations use per-transaction HUF rounding.</span></div>
              <button className="secondary-button" type="button" onClick={downloadPdf} disabled={isDownloading}>
                {isDownloading ? <><span className="spinner dark" /> Preparing PDF…</> : <><Icon name="download" /> Download PDF</>}
              </button>
            </div>
          </section>
        )}
      </main>

      <footer><span>VAT Declaration Generator</span><span>Files are processed in memory and are not stored.</span></footer>
    </div>
  );
}

export default App;
