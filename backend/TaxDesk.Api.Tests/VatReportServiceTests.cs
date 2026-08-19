using System.Text;
using TaxDesk.Api.Features.VatReports;

using Xunit;

namespace TaxDesk.Api.Tests;

public sealed class VatReportServiceTests
{
    private readonly VatReportService _service = new(new CsvVatReportParser());

    [Fact]
    public async Task CreateAsync_GroupsAllSupportedRatesAndCalculatesGrandTotals()
    {
        const string csv = """
            invoiceNumber,date,netAmount,vatRate
            INV-001,2026-01-10,1000.00,27
            INV-002,2026-01-11,2000.00,18
            INV-003,2026-01-12,500.00,5
            INV-004,2026-01-13,100.00,0
            """;

        var report = await CreateReportAsync(csv);

        Assert.Equal(4, report.TransactionCount);
        Assert.Equal(4, report.Categories.Count);
        Assert.Equal(3600m, report.Totals.NetAmount);
        Assert.Equal(655m, report.Totals.VatAmount);
        Assert.Equal(4255m, report.Totals.GrossAmount);
        Assert.Equal(new DateOnly(2026, 1, 10), report.DateFrom);
        Assert.Equal(new DateOnly(2026, 1, 13), report.DateTo);
    }

    [Fact]
    public async Task CreateAsync_RoundsVatPerTransactionAwayFromZero()
    {
        const string csv = """
            invoiceNumber,date,netAmount,vatRate
            INV-001,2026-01-10,33.33,27
            INV-002,2026-01-10,-33.33,27
            """;

        var report = await CreateReportAsync(csv);

        Assert.Equal(0m, report.Totals.NetAmount);
        Assert.Equal(0m, report.Totals.VatAmount);
        Assert.Equal(0m, report.Totals.GrossAmount);
    }

    [Fact]
    public async Task CreateAsync_AcceptsSemicolonCsvWithHungarianDecimalComma()
    {
        const string csv = """
            invoiceNumber;date;netAmount;vatRate
            INV-001;2026-01-10;1000,50;27
            """;

        var report = await CreateReportAsync(csv);

        Assert.Equal(1000.50m, report.Totals.NetAmount);
        Assert.Equal(270.14m, report.Totals.VatAmount);
        Assert.Equal(1270.64m, report.Totals.GrossAmount);
    }

    [Fact]
    public async Task CreateAsync_ReportsTheRowAndFieldForUnsupportedVatRate()
    {
        const string csv = """
            invoiceNumber,date,netAmount,vatRate
            INV-001,2026-01-10,1000.00,20
            """;

        var exception = await Assert.ThrowsAsync<VatFileValidationException>(
            () => CreateReportAsync(csv));

        var error = Assert.Single(exception.Errors);
        Assert.Equal(2, error.Row);
        Assert.Equal("vatRate", error.Field);
    }

    [Fact]
    public async Task CreateAsync_RejectsBinaryNullBytes()
    {
        const string csv = "invoiceNumber,date,netAmount,vatRate\nINV-\0X,2026-01-10,1000,27";

        var exception = await Assert.ThrowsAsync<VatFileValidationException>(
            () => CreateReportAsync(csv));

        Assert.Contains(exception.Errors, error => error.Message.Contains("Binary content"));
    }

    [Fact]
    public async Task PdfGenerator_ProducesAValidSinglePagePdfEnvelope()
    {
        const string csv = """
            invoiceNumber,date,netAmount,vatRate
            INV-001,2026-01-10,1000.00,27
            """;
        var report = await CreateReportAsync(csv);

        var pdf = new SimplePdfGenerator().Generate(report);
        var text = Encoding.ASCII.GetString(pdf);

        Assert.StartsWith("%PDF-1.4", text);
        Assert.Contains("Hungarian VAT Declaration Summary", text);
        Assert.EndsWith("%%EOF\n", text);
    }

    private async Task<VatReport> CreateReportAsync(string csv)
    {
        await using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));
        return await _service.CreateAsync(stream, "invoices.csv");
    }
}
