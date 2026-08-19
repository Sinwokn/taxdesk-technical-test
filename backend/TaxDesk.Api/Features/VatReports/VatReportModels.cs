namespace TaxDesk.Api.Features.VatReports;

public sealed record VatTransaction(
    string InvoiceNumber,
    DateOnly Date,
    decimal NetAmount,
    decimal VatRate);

public sealed record VatCategorySummary(
    decimal VatRate,
    int TransactionCount,
    decimal NetAmount,
    decimal VatAmount,
    decimal GrossAmount);

public sealed record MoneyTotals(
    decimal NetAmount,
    decimal VatAmount,
    decimal GrossAmount);

public sealed record VatReport(
    Guid ReportId,
    string SourceFileName,
    DateTimeOffset GeneratedAtUtc,
    int TransactionCount,
    DateOnly DateFrom,
    DateOnly DateTo,
    IReadOnlyList<VatCategorySummary> Categories,
    MoneyTotals Totals);

public sealed record ValidationError(
    int? Row,
    string Field,
    string Message);

public sealed class VatFileValidationException(IReadOnlyList<ValidationError> errors)
    : Exception("The uploaded CSV file is invalid.")
{
    public IReadOnlyList<ValidationError> Errors { get; } = errors;
}
