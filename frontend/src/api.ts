import type { ApiError, VatReport } from "./types";

export class VatApiError extends Error {
  readonly details: ApiError;

  constructor(details: ApiError) {
    super(details.title);
    this.name = "VatApiError";
    this.details = details;
  }
}

async function getError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiError>;
    return {
      title: body.title || "The request could not be completed.",
      status: response.status,
      errors: body.errors
    };
  } catch {
    return {
      title: response.status >= 500
        ? "The service encountered an unexpected error."
        : "The request could not be completed.",
      status: response.status
    };
  }
}

function formDataFor(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return formData;
}

export async function createVatReport(file: File): Promise<VatReport> {
  const response = await fetch("/api/vat-reports", {
    method: "POST",
    body: formDataFor(file)
  });

  if (!response.ok) {
    throw new VatApiError(await getError(response));
  }

  return response.json() as Promise<VatReport>;
}

export async function downloadVatReport(file: File): Promise<void> {
  const response = await fetch("/api/vat-reports/pdf", {
    method: "POST",
    body: formDataFor(file)
  });

  if (!response.ok) {
    throw new VatApiError(await getError(response));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vat-declaration-summary.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
