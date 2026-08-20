import { ChangeEvent, DragEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { createVatReport, downloadVatReport, VatApiError } from "./api";
import type { ApiError, VatCategorySummary, VatReport } from "./types";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
type Language = "en" | "hu";
type IconName = "overview" | "upload" | "report" | "shield" | "file" | "download" | "check" | "close" | "arrow" | "calendar" | "chart" | "refresh";

const copy = {
  en: {
    workspace: "Hungarian VAT workspace", overview: "Overview", sourceData: "Source data", report: "VAT report",
    session: "Current session",
    pageTitle: "VAT overview", pageIntro: "Validate invoice data, review ÁFA exposure, and prepare a consistent declaration summary.",
    period: "Reporting period", noPeriod: "Not generated", totalNet: "Taxable net", vatPayable: "VAT payable",
    totalGross: "Gross total", transactions: "Transactions", waitingForData: "Waiting for data",
    readyToValidate: "Ready to validate", currentReport: "Current report", uploadTitle: "Import invoice data",
    uploadDescription: "Upload the CSV for this reporting session.", sample: "Use sample data",
    dropTitle: "Drop your invoice CSV here", dropBody: "or choose a file from your computer",
    fileRequirements: "CSV only · Maximum 2 MB · Up to 10,000 rows", selectedFile: "Selected source", ready: "Ready",
    expectedColumns: "Expected columns", acceptedRates: "Accepted rates: 0%, 5%, 18%, 27%",
    generate: "Validate & generate report", regenerate: "Regenerate report", processing: "Validating invoice data…",
    removeFile: "Remove selected file", readinessTitle: "Report readiness",
    readinessDescription: "Checks performed for this report.", checkFile: "Source file selected",
    checkSchema: "CSV structure validated", checkRates: "VAT categories verified",
    checkCalculation: "Totals calculated per transaction", checkPdf: "PDF ready to generate",
    pending: "Pending", complete: "Complete", needsAttention: "Needs attention", insightsTitle: "VAT distribution",
    insightsDescription: "Taxable net amount by VAT category from the current report.",
    noInsights: "Your chart will appear after a report is generated.",
    noInsightsBody: "Only the current file is visualised—no historical or example data is invented.",
    shareOfNet: "of absolute taxable net", controlsTitle: "Compliance checks",
    controlsDescription: "Validation controls applied before totals are shown.", utf8: "UTF-8 CSV structure accepted",
    supportedRates: "Only supported Hungarian VAT rates", rowRounding: "VAT rounded on every transaction",
    corrections: "Negative correction lines included", reportTitle: "Declaration summary",
    reportDescription: "Formatted totals broken down by Hungarian VAT category.", validated: "Validated report",
    generated: "Generated", reportId: "Report ID", source: "Source", vatCategory: "VAT category",
    netAmount: "Net amount", vatAmount: "VAT amount", grossAmount: "Gross amount", total: "Total",
    reviewStatus: "Ready for review", reviewBody: "Calculated with per-transaction HUF rounding. Review before NAV submission.",
    downloadPdf: "Download PDF", preparingPdf: "Preparing PDF…", pdfDownloaded: "PDF prepared. Download started.",
    pdfNote: "The PDF is generated from the same validated source data.",
    disclaimer: "This summary supports review and does not replace an official NAV submission form.",
    languageLabel: "Interface language", english: "EN", hungarian: "HU",
    onboardingLabel: "Quick start", onboardingTitle: "Start with your invoice CSV",
    onboardingBody: "Drop it below or use sample data to preview the workflow.",
    dismissOnboarding: "Dismiss onboarding tip"
  },
  hu: {
    workspace: "Magyar áfa munkaterület", overview: "Áttekintés", sourceData: "Forrásadatok", report: "Áfajelentés",
    session: "Aktuális munkamenet",
    pageTitle: "Áfaáttekintés",
    pageIntro: "Ellenőrizze a számlaadatokat, tekintse át az áfakitettséget, és készítsen egységes bevallási összesítőt.",
    period: "Bevallási időszak", noPeriod: "Még nincs jelentés", totalNet: "Adóalap", vatPayable: "Fizetendő áfa",
    totalGross: "Bruttó összeg", transactions: "Tételek", waitingForData: "Adatokra vár",
    readyToValidate: "Ellenőrzésre kész", currentReport: "Aktuális jelentés", uploadTitle: "Számlaadatok importálása",
    uploadDescription: "Töltse fel a munkamenet CSV-fájlját.",
    sample: "Mintaadatok használata", dropTitle: "Húzza ide a számlákat tartalmazó CSV-fájlt",
    dropBody: "vagy válasszon fájlt a számítógépéről", fileRequirements: "Csak CSV · Legfeljebb 2 MB · Maximum 10 000 sor",
    selectedFile: "Kiválasztott forrás", ready: "Kész", expectedColumns: "Elvárt oszlopok",
    acceptedRates: "Elfogadott kulcsok: 0%, 5%, 18%, 27%", generate: "Ellenőrzés és jelentéskészítés",
    regenerate: "Jelentés újragenerálása", processing: "Számlaadatok ellenőrzése…",
    removeFile: "Kiválasztott fájl eltávolítása", readinessTitle: "Jelentés állapota",
    readinessDescription: "A jelentésen elvégzett ellenőrzések.",
    checkFile: "Forrásfájl kiválasztva", checkSchema: "CSV-szerkezet ellenőrizve",
    checkRates: "Áfakulcsok ellenőrizve", checkCalculation: "Összegek tételenként kiszámítva",
    checkPdf: "PDF előállítható", pending: "Függőben", complete: "Kész", needsAttention: "Beavatkozás szükséges",
    insightsTitle: "Áfaeloszlás", insightsDescription: "Adóalap áfakulcsonként az aktuális jelentés alapján.",
    noInsights: "A diagram a jelentés elkészítése után jelenik meg.",
    noInsightsBody: "Csak az aktuális fájlt ábrázoljuk—nem használunk kitalált előzmény- vagy mintaadatokat.",
    shareOfNet: "a teljes abszolút adóalapból", controlsTitle: "Megfelelőségi ellenőrzések",
    controlsDescription: "Az összegek megjelenítése előtt alkalmazott ellenőrzések.",
    utf8: "UTF-8 CSV-szerkezet elfogadva", supportedRates: "Csak támogatott magyar áfakulcsok",
    rowRounding: "Áfa minden tételnél kerekítve", corrections: "Negatív helyesbítő tételek figyelembe véve",
    reportTitle: "Bevallási összesítő", reportDescription: "Magyar áfakulcsonként bontott, formázott összesítés.",
    validated: "Ellenőrzött jelentés", generated: "Létrehozva", reportId: "Jelentésazonosító", source: "Forrás",
    vatCategory: "Áfakategória", netAmount: "Nettó összeg", vatAmount: "Áfa összege",
    grossAmount: "Bruttó összeg", total: "Összesen", reviewStatus: "Ellenőrzésre kész",
    reviewBody: "Tételenkénti HUF-kerekítéssel számítva. A NAV-benyújtás előtt ellenőrizendő.",
    downloadPdf: "PDF letöltése", preparingPdf: "PDF készítése…", pdfDownloaded: "A PDF elkészült. A letöltés elindult.",
    pdfNote: "A PDF ugyanabból az ellenőrzött forrásadatból készül.",
    disclaimer: "Az összesítő az ellenőrzést támogatja, és nem helyettesíti a hivatalos NAV-bevallást.",
    languageLabel: "Felület nyelve", english: "EN", hungarian: "HU",
    onboardingLabel: "Gyors kezdés", onboardingTitle: "Kezdje a számlákat tartalmazó CSV-fájllal",
    onboardingBody: "Húzza ide lent, vagy tekintse meg a folyamatot a mintaadatokkal.",
    dismissOnboarding: "Bevezető tipp bezárása"
  }
} as const;

const huErrorTitles: Record<string, string> = {
  "Please select a CSV file.": "Kérjük, válasszon CSV-fájlt.",
  "The CSV file must be 2 MB or smaller.": "A CSV-fájl mérete legfeljebb 2 MB lehet.",
  "The sample file could not be loaded.": "A mintafájl nem tölthető be.",
  "The service is unavailable. Please try again.": "A szolgáltatás nem érhető el. Próbálja újra.",
  "The PDF could not be downloaded. Please try again.": "A PDF nem tölthető le. Próbálja újra.",
  "The CSV file could not be processed.": "A CSV-fájl nem dolgozható fel."
};

const huErrorMessages: Record<string, string> = {
  "Use the ISO date format YYYY-MM-DD.": "Használja az ÉÉÉÉ-HH-NN ISO dátumformátumot.",
  "Must be a valid decimal number.": "Érvényes tizedes szám szükséges.",
  "Must be a valid numeric VAT rate.": "Érvényes numerikus áfakulcs szükséges.",
  "Supported Hungarian VAT rates are 0, 5, 18, and 27.": "A támogatott magyar áfakulcsok: 0, 5, 18 és 27.",
  "Must contain 1-100 printable characters.": "1–100 nyomtatható karakter szükséges.",
  "The file must be valid UTF-8 text.": "A fájlnak érvényes UTF-8 szövegnek kell lennie.",
  "Binary content is not accepted.": "Bináris tartalom nem fogadható el."
};

const fieldNames = {
  en: { file: "File", headers: "Headers", invoiceNumber: "Invoice number", date: "Date", netAmount: "Net amount", vatRate: "VAT rate" },
  hu: { file: "Fájl", headers: "Fejléc", invoiceNumber: "Számlaszám", date: "Dátum", netAmount: "Nettó összeg", vatRate: "Áfakulcs" }
} as const;

const categoryColors: Record<number, string> = { 0: "slate", 5: "teal", 18: "blue", 27: "indigo" };
const formatMoney = (value: number) => new Intl.NumberFormat("hu-HU", {
  style: "currency", currency: "HUF", minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(value);

function formatDate(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "hu" ? "hu-HU" : "en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "hu" ? "hu-HU" : "en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "UTC", timeZoneName: "short"
  }).format(new Date(value));
}

function formatFileSize(bytes: number, language: Language): string {
  if (bytes < 1024) return `${bytes} B`;
  const size = new Intl.NumberFormat(language === "hu" ? "hu-HU" : "en-GB", { maximumFractionDigits: 1 }).format(bytes / 1024);
  return `${size} KB`;
}

function localizeError(error: ApiError, language: Language): ApiError {
  if (language === "en") return error;
  return {
    ...error,
    title: huErrorTitles[error.title] ?? error.title,
    errors: error.errors?.map((item) => ({ ...item, message: huErrorMessages[item.message] ?? item.message }))
  };
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></>,
    report: <><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h7M9 16h7"/></>,
    shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <><path d="m7 7 10 10"/><path d="m17 7-10 10"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.5-2L20 8M4 16l2.4 2a7 7 0 0 0 11.5-2"/></>
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function CategoryChart({ categories, language }: { categories: VatCategorySummary[]; language: Language }) {
  const t = copy[language];
  const total = categories.reduce((sum, category) => sum + Math.abs(category.netAmount), 0);
  const maximum = Math.max(...categories.map((category) => Math.abs(category.netAmount)), 1);
  return (
    <div className="chart-content">
      <div className="distribution-track" role="img" aria-label={t.insightsDescription}>
        {categories.map((category) => {
          const share = total === 0 ? 0 : Math.abs(category.netAmount) / total * 100;
          return <span key={category.vatRate} className={`chart-color-${categoryColors[category.vatRate] ?? "slate"}`} style={{ width: `${share}%` }} title={`${category.vatRate}%: ${Math.round(share)}%`}/>;
        })}
      </div>
      <div className="bar-chart">
        {categories.map((category) => {
          const share = total === 0 ? 0 : Math.abs(category.netAmount) / total * 100;
          const width = Math.abs(category.netAmount) / maximum * 100;
          const color = categoryColors[category.vatRate] ?? "slate";
          return <div className="bar-row" key={category.vatRate}>
            <div className="bar-label"><span className={`legend-dot chart-color-${color}`}/><strong>{category.vatRate}% ÁFA</strong></div>
            <div className="bar-value"><strong>{formatMoney(category.netAmount)}</strong><span>{Math.round(share)}% {t.shareOfNet}</span></div>
            <div className="bar-track"><span className={`chart-color-${color}`} style={{ width: width === 0 ? "2px" : `${width}%` }}/></div>
          </div>;
        })}
      </div>
    </div>
  );
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLElement>(null);
  const [language, setLanguage] = useState<Language>("en");
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<VatReport | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem("taxdesk:onboarding-dismissed") !== "true";
    } catch {
      return true;
    }
  });

  const t = copy[language];
  const visibleError = error ? localizeError(error, language) : null;
  const busy = isProcessing || isDownloading;

  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { if (report) reportRef.current?.focus(); }, [report]);

  function dismissOnboarding() {
    setShowOnboarding(false);
    try {
      localStorage.setItem("taxdesk:onboarding-dismissed", "true");
    } catch {
      // The tip still dismisses for this session when browser storage is unavailable.
    }
  }

  function selectFile(nextFile?: File) {
    if (busy) return;
    setReport(null);
    setError(null);
    setPdfDownloaded(false);
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

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!busy) selectFile(event.dataTransfer.files[0]);
  }

  function onDragLeave(event: DragEvent<HTMLLabelElement>) {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setIsDragging(false);
  }

  async function loadSample() {
    if (busy) return;
    setError(null);
    setPdfDownloaded(false);
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
    if (!file || busy) return;
    setIsProcessing(true);
    setError(null);
    setReport(null);
    setPdfDownloaded(false);
    try {
      setReport(await createVatReport(file));
    } catch (caught) {
      setError(caught instanceof VatApiError ? caught.details : { title: "The service is unavailable. Please try again." });
    } finally {
      setIsProcessing(false);
    }
  }

  async function downloadPdf() {
    if (!file || busy) return;
    setIsDownloading(true);
    setError(null);
    setPdfDownloaded(false);
    try {
      await downloadVatReport(file);
      setPdfDownloaded(true);
    } catch (caught) {
      setError(caught instanceof VatApiError ? caught.details : { title: "The PDF could not be downloaded. Please try again." });
    } finally {
      setIsDownloading(false);
    }
  }

  const periodLabel = report ? `${formatDate(report.dateFrom, language)} – ${formatDate(report.dateTo, language)}` : t.noPeriod;
  const progressItems = [
    { label: t.checkFile, done: Boolean(file) },
    { label: t.checkSchema, done: Boolean(report) },
    { label: t.checkRates, done: Boolean(report) },
    { label: t.checkCalculation, done: Boolean(report) },
    { label: t.checkPdf, done: Boolean(report) }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label={t.workspace}>
        <a className="sidebar-brand" href="#overview" aria-label={`Tax Desk · ${t.workspace}`}>
          <img className="company-logo" src="/tax-desk-logo.svg" alt=""/>
          <span className="brand-copy"><strong>Tax Desk</strong><small>{t.workspace}</small></span>
        </a>
        <nav className="sidebar-nav" aria-label={t.session}>
          <span className="nav-label">{t.session}</span>
          <a className="nav-item active" href="#overview"><Icon name="overview"/><span>{t.overview}</span></a>
          <a className="nav-item" href="#workspace"><Icon name="upload"/><span>{t.sourceData}</span></a>
          <a className={`nav-item ${report ? "" : "disabled"}`} href={report ? "#report" : "#overview"} aria-disabled={!report} tabIndex={report ? 0 : -1}>
            <Icon name="report"/><span>{t.report}</span>{report && <i className="nav-complete"><Icon name="check"/></i>}
          </a>
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div><span className="topbar-kicker">Tax Desk / {t.session}</span><strong className="topbar-title">{t.pageTitle}</strong></div>
          <div className="topbar-actions">
            <div className="language-switch" role="group" aria-label={t.languageLabel}>
              <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"}>{t.english}</button>
              <button type="button" className={language === "hu" ? "active" : ""} onClick={() => setLanguage("hu")} aria-pressed={language === "hu"}>{t.hungarian}</button>
            </div>
          </div>
        </header>

        <main className="dashboard" id="overview">
          <section className="dashboard-intro" aria-labelledby="intro-heading">
            <div><span className="eyebrow"><span className="status-dot"/>{report ? t.currentReport : file ? t.readyToValidate : t.waitingForData}</span><h1 id="intro-heading">{t.pageTitle}</h1><p>{t.pageIntro}</p></div>
            <div className="period-card"><span className="period-icon"><Icon name="calendar"/></span><span><small>{t.period}</small><strong>{periodLabel}</strong></span></div>
          </section>

          <section className="metrics-grid" aria-label={t.overview}>
            <article className="metric-card"><span className="metric-label">{t.totalNet}</span><strong>{report ? formatMoney(report.totals.netAmount) : "—"}</strong><small>{report ? t.currentReport : t.waitingForData}</small></article>
            <article className="metric-card metric-primary"><span className="metric-label">{t.vatPayable}</span><strong>{report ? formatMoney(report.totals.vatAmount) : "—"}</strong><small>{report ? t.readyToValidate : t.waitingForData}</small></article>
            <article className="metric-card"><span className="metric-label">{t.totalGross}</span><strong>{report ? formatMoney(report.totals.grossAmount) : "—"}</strong><small>{report ? t.currentReport : t.waitingForData}</small></article>
            <article className="metric-card"><span className="metric-label">{t.transactions}</span><strong>{report ? new Intl.NumberFormat(language === "hu" ? "hu-HU" : "en-GB").format(report.transactionCount) : "—"}</strong><small>{report ? periodLabel : t.waitingForData}</small></article>
          </section>

          <section className="workspace-grid" id="workspace" aria-labelledby="upload-heading">
            <article className="panel upload-panel" aria-busy={isProcessing}>
              <div className="panel-heading">
                <div><span className="panel-icon"><Icon name="upload"/></span><span><h2 id="upload-heading">{t.uploadTitle}</h2><p>{t.uploadDescription}</p></span></div>
                <button className="text-button" type="button" onClick={loadSample} disabled={busy}>{t.sample}<Icon name="arrow"/></button>
              </div>

              {showOnboarding && !file && (
                <aside className="onboarding-tip" aria-label={t.onboardingTitle}>
                  <button type="button" onClick={dismissOnboarding} aria-label={t.dismissOnboarding}><Icon name="close"/></button>
                  <small>{t.onboardingLabel}</small>
                  <strong>{t.onboardingTitle}</strong>
                  <p>{t.onboardingBody}</p>
                  <span className="onboarding-pointer" aria-hidden="true"><Icon name="arrow"/></span>
                </aside>
              )}

              {!file ? (
                <label className={`dropzone ${isDragging ? "is-dragging" : ""} ${busy ? "is-disabled" : ""}`}
                  onDragEnter={(event) => { event.preventDefault(); if (!busy) setIsDragging(true); }}
                  onDragOver={(event) => event.preventDefault()} onDragLeave={onDragLeave} onDrop={onDrop}>
                  <span className="upload-icon"><Icon name="upload"/></span>
                  <strong>{t.dropTitle}</strong><span>{t.dropBody}</span><small>{t.fileRequirements}</small>
                  <input ref={inputRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={onInputChange} disabled={busy}/>
                </label>
              ) : (
                <div className="selected-file">
                  <span className="file-icon"><Icon name="file"/></span>
                  <span className="file-details"><small>{t.selectedFile}</small><strong>{file.name}</strong><span>{formatFileSize(file.size, language)} · {t.readyToValidate}</span></span>
                  <span className="ready-badge"><Icon name="check"/>{t.ready}</span>
                  <button className="icon-button" type="button" onClick={() => selectFile()} aria-label={t.removeFile} disabled={busy}><Icon name="close"/></button>
                </div>
              )}

              <div className="schema-note"><strong>{t.expectedColumns}</strong><span className="schema-fields"><code>invoiceNumber</code><code>date</code><code>netAmount</code><code>vatRate</code></span><span>{t.acceptedRates}</span></div>

              {visibleError && <div className="error-panel" role="alert"><span className="error-icon">!</span><div><strong>{visibleError.title}</strong>{visibleError.errors && visibleError.errors.length > 0 && <ul>{visibleError.errors.map((item, index) =>
                <li key={`${item.row}-${item.field}-${index}`}><b>{item.row ? `${language === "hu" ? "Sor" : "Row"} ${item.row}` : language === "hu" ? "Fájl" : "File"} · {fieldNames[language][item.field as keyof typeof fieldNames.en] ?? item.field}</b><span>{item.message}</span></li>
              )}</ul>}</div></div>}

              <button className="primary-button" type="button" disabled={!file || busy} onClick={processFile} aria-busy={isProcessing}>
                {isProcessing ? <><span className="spinner"/>{t.processing}</> : <>{report ? <Icon name="refresh"/> : <Icon name="shield"/>}{report ? t.regenerate : t.generate}<Icon name="arrow"/></>}
              </button>
            </article>

            <aside className="panel readiness-panel" aria-labelledby="readiness-heading">
              <div className="panel-heading compact"><div><span className="panel-icon"><Icon name="shield"/></span><span><h2 id="readiness-heading">{t.readinessTitle}</h2><p>{t.readinessDescription}</p></span></div></div>
              <ol className="readiness-list">
                {progressItems.map((item, index) => {
                  const attention = Boolean(error) && index > 0;
                  return <li key={item.label} className={item.done ? "done" : attention ? "attention" : ""}><span className="readiness-marker">{item.done ? <Icon name="check"/> : attention ? "!" : index + 1}</span><span><strong>{item.label}</strong><small>{item.done ? t.complete : attention ? t.needsAttention : t.pending}</small></span></li>;
                })}
              </ol>
            </aside>
          </section>

          <section className="analytics-grid" aria-label={t.insightsTitle}>
            <article className="panel chart-panel">
              <div className="panel-heading compact"><div><span className="panel-icon"><Icon name="chart"/></span><span><h2>{t.insightsTitle}</h2><p>{t.insightsDescription}</p></span></div></div>
              {report ? <CategoryChart categories={report.categories} language={language}/> :
                <div className="empty-chart"><div className="chart-placeholder" aria-hidden="true"><span/><span/><span/><span/></div><strong>{t.noInsights}</strong><p>{t.noInsightsBody}</p></div>}
            </article>

            <article className="panel controls-panel">
              <div className="panel-heading compact"><div><span className="panel-icon"><Icon name="shield"/></span><span><h2>{t.controlsTitle}</h2><p>{t.controlsDescription}</p></span></div></div>
              <ul className="controls-list">
                {[t.utf8, t.supportedRates, t.rowRounding, t.corrections].map((label) =>
                  <li key={label} className={report ? "confirmed" : ""}><span><Icon name={report ? "check" : "shield"}/></span><strong>{label}</strong></li>
                )}
              </ul>
            </article>
          </section>

          {report && (
            <section className="panel report-panel" id="report" aria-labelledby="report-heading" ref={reportRef} tabIndex={-1}>
              <div className="report-header">
                <div><span className="validated-badge"><Icon name="check"/>{t.validated}</span><h2 id="report-heading">{t.reportTitle}</h2><p>{t.reportDescription}</p></div>
                <div className="report-identity">
                  <span><small>{t.reportId}</small><strong>{report.reportId.slice(0, 8).toUpperCase()}</strong></span>
                  <span><small>{t.generated}</small><strong>{formatDateTime(report.generatedAtUtc, language)}</strong></span>
                </div>
              </div>

              <div className="report-source">
                <span><Icon name="file"/></span>
                <div><small>{t.source}</small><strong>{report.sourceFileName}</strong></div>
                <div><small>{t.period}</small><strong>{periodLabel}</strong></div>
                <div><small>{t.transactions}</small><strong>{report.transactionCount}</strong></div>
              </div>

              <div className="table-wrap">
                <table>
                  <caption className="visually-hidden">{t.reportDescription}</caption>
                  <thead><tr><th>{t.vatCategory}</th><th>{t.transactions}</th><th>{t.netAmount}</th><th>{t.vatAmount}</th><th>{t.grossAmount}</th></tr></thead>
                  <tbody>{report.categories.map((category) => {
                    const color = categoryColors[category.vatRate] ?? "slate";
                    return <tr key={category.vatRate}>
                      <td data-label={t.vatCategory}><span className={`rate-pill rate-${color}`}><span/>{category.vatRate}% ÁFA</span></td>
                      <td data-label={t.transactions}>{category.transactionCount}</td>
                      <td data-label={t.netAmount}>{formatMoney(category.netAmount)}</td>
                      <td data-label={t.vatAmount}>{formatMoney(category.vatAmount)}</td>
                      <td data-label={t.grossAmount}>{formatMoney(category.grossAmount)}</td>
                    </tr>;
                  })}</tbody>
                  <tfoot><tr><th data-label={t.total}>{t.total}</th><td data-label={t.transactions}>{report.transactionCount}</td><td data-label={t.netAmount}>{formatMoney(report.totals.netAmount)}</td><td data-label={t.vatAmount}>{formatMoney(report.totals.vatAmount)}</td><td data-label={t.grossAmount}>{formatMoney(report.totals.grossAmount)}</td></tr></tfoot>
                </table>
              </div>

              <div className="report-actions">
                <div className="review-state"><span><Icon name="shield"/></span><div><strong>{t.reviewStatus}</strong><p>{t.reviewBody}</p></div></div>
                <div className="pdf-action">
                  <button className="secondary-button" type="button" onClick={downloadPdf} disabled={busy} aria-busy={isDownloading}>
                    {isDownloading ? <><span className="spinner dark"/>{t.preparingPdf}</> : <><Icon name="download"/>{t.downloadPdf}</>}
                  </button>
                  <small>{t.pdfNote}</small>
                </div>
              </div>
              <div className="status-region" aria-live="polite">{pdfDownloaded ? t.pdfDownloaded : ""}</div>
              <p className="report-disclaimer">{t.disclaimer}</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
