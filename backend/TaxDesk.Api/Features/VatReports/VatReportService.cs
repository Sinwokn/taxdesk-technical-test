namespace TaxDesk.Api.Features.VatReports;

public sealed class VatReportService(CsvVatReportParser parser)
{
    public async Task<VatReport> CreateAsync(
        Stream source,
        string sourceFileName,
        CancellationToken cancellationToken = default)
    {
        var transactions = await parser.ParseAsync(source, cancellationToken);

        var categories = transactions
            .GroupBy(transaction => transaction.VatRate)
            .OrderBy(group => group.Key)
            .Select(group =>
            {
                var netAmount = group.Sum(transaction => transaction.NetAmount);
                var vatAmount = group.Sum(CalculateVat);
                return new VatCategorySummary(
                    group.Key,
                    group.Count(),
                    netAmount,
                    vatAmount,
                    netAmount + vatAmount);
            })
            .ToArray();

        var totals = new MoneyTotals(
            categories.Sum(category => category.NetAmount),
            categories.Sum(category => category.VatAmount),
            categories.Sum(category => category.GrossAmount));

        return new VatReport(
            Guid.NewGuid(),
            sourceFileName,
            DateTimeOffset.UtcNow,
            transactions.Count,
            transactions.Min(transaction => transaction.Date),
            transactions.Max(transaction => transaction.Date),
            categories,
            totals);
    }

    internal static decimal CalculateVat(VatTransaction transaction) =>
        decimal.Round(
            transaction.NetAmount * transaction.VatRate / 100m,
            decimals: 2,
            MidpointRounding.AwayFromZero);
}
