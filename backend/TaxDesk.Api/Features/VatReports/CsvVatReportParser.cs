using System.Globalization;
using System.Text;

namespace TaxDesk.Api.Features.VatReports;

public sealed class CsvVatReportParser
{
    public const long MaximumFileSizeBytes = 2 * 1024 * 1024;
    public const int MaximumRows = 10_000;

    private const decimal MaximumAbsoluteNetAmount = 1_000_000_000_000m;
    private static readonly decimal[] AllowedVatRates = [0m, 5m, 18m, 27m];
    private static readonly string[] RequiredHeaders =
        ["invoiceNumber", "date", "netAmount", "vatRate"];

    public async Task<IReadOnlyList<VatTransaction>> ParseAsync(
        Stream stream,
        CancellationToken cancellationToken = default)
    {
        var utf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
        using var reader = new StreamReader(
            stream,
            utf8,
            detectEncodingFromByteOrderMarks: true,
            bufferSize: 16 * 1024,
            leaveOpen: true);

        string? headerLine;
        try
        {
            headerLine = await reader.ReadLineAsync(cancellationToken);
        }
        catch (DecoderFallbackException)
        {
            throw InvalidFile("file", "The file must be valid UTF-8 text.");
        }

        if (string.IsNullOrWhiteSpace(headerLine))
        {
            throw InvalidFile("file", "The CSV file is empty.");
        }

        RejectNullBytes(headerLine);
        var delimiter = DetectDelimiter(headerLine);
        var headers = ParseLine(headerLine, delimiter, rowNumber: 1);
        var headerIndexes = ValidateAndIndexHeaders(headers);

        var transactions = new List<VatTransaction>();
        var errors = new List<ValidationError>();
        var rowNumber = 1;

        while (!reader.EndOfStream)
        {
            cancellationToken.ThrowIfCancellationRequested();
            rowNumber++;

            string? line;
            try
            {
                line = await reader.ReadLineAsync(cancellationToken);
            }
            catch (DecoderFallbackException)
            {
                errors.Add(new ValidationError(rowNumber, "file", "The file must be valid UTF-8 text."));
                break;
            }

            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            if (transactions.Count >= MaximumRows)
            {
                errors.Add(new ValidationError(null, "file", $"The file may contain at most {MaximumRows:N0} data rows."));
                break;
            }

            try
            {
                RejectNullBytes(line);
                var columns = ParseLine(line, delimiter, rowNumber);
                ParseRow(columns, headerIndexes, delimiter, rowNumber, transactions, errors);
            }
            catch (VatFileValidationException exception)
            {
                errors.AddRange(exception.Errors);
            }

            if (errors.Count >= 50)
            {
                errors.Add(new ValidationError(null, "file", "Validation stopped after 50 errors."));
                break;
            }
        }

        if (transactions.Count == 0 && errors.Count == 0)
        {
            errors.Add(new ValidationError(null, "file", "The CSV file contains no transaction rows."));
        }

        if (errors.Count > 0)
        {
            throw new VatFileValidationException(errors);
        }

        return transactions;
    }

    private static char DetectDelimiter(string headerLine)
    {
        var commaCount = headerLine.Count(character => character == ',');
        var semicolonCount = headerLine.Count(character => character == ';');

        if (commaCount == 0 && semicolonCount == 0)
        {
            throw InvalidFile("headers", "The header must use comma or semicolon delimiters.");
        }

        return semicolonCount > commaCount ? ';' : ',';
    }

    private static Dictionary<string, int> ValidateAndIndexHeaders(IReadOnlyList<string> headers)
    {
        var indexes = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < headers.Count; index++)
        {
            var header = headers[index].Trim();
            if (!indexes.TryAdd(header, index))
            {
                throw InvalidFile("headers", $"Duplicate header '{header}'.");
            }
        }

        var missing = RequiredHeaders.Where(required => !indexes.ContainsKey(required)).ToArray();
        if (missing.Length > 0)
        {
            throw InvalidFile("headers", $"Missing required header(s): {string.Join(", ", missing)}.");
        }

        return indexes;
    }

    private static void ParseRow(
        IReadOnlyList<string> columns,
        IReadOnlyDictionary<string, int> indexes,
        char delimiter,
        int rowNumber,
        ICollection<VatTransaction> transactions,
        ICollection<ValidationError> errors)
    {
        var invoiceNumber = GetColumn(columns, indexes, "invoiceNumber").Trim();
        var dateText = GetColumn(columns, indexes, "date").Trim();
        var netAmountText = GetColumn(columns, indexes, "netAmount").Trim();
        var vatRateText = GetColumn(columns, indexes, "vatRate").Trim();
        var rowErrors = new List<ValidationError>();

        if (invoiceNumber.Length is < 1 or > 100 || invoiceNumber.Any(char.IsControl))
        {
            rowErrors.Add(new ValidationError(rowNumber, "invoiceNumber", "Must contain 1-100 printable characters."));
        }

        if (!DateOnly.TryParseExact(
                dateText,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var date))
        {
            rowErrors.Add(new ValidationError(rowNumber, "date", "Use the ISO date format YYYY-MM-DD."));
        }

        if (!TryParseDecimal(netAmountText, delimiter, out var netAmount))
        {
            rowErrors.Add(new ValidationError(rowNumber, "netAmount", "Must be a valid decimal number."));
        }
        else if (Math.Abs(netAmount) > MaximumAbsoluteNetAmount)
        {
            rowErrors.Add(new ValidationError(rowNumber, "netAmount", "The absolute amount exceeds the supported limit."));
        }

        if (!TryParseDecimal(vatRateText.TrimEnd('%'), delimiter, out var vatRate))
        {
            rowErrors.Add(new ValidationError(rowNumber, "vatRate", "Must be a valid numeric VAT rate."));
        }
        else if (!AllowedVatRates.Contains(vatRate))
        {
            rowErrors.Add(new ValidationError(rowNumber, "vatRate", "Supported Hungarian VAT rates are 0, 5, 18, and 27."));
        }

        if (rowErrors.Count > 0)
        {
            foreach (var error in rowErrors)
            {
                errors.Add(error);
            }

            return;
        }

        transactions.Add(new VatTransaction(invoiceNumber, date, netAmount, vatRate));
    }

    private static bool TryParseDecimal(string value, char delimiter, out decimal result)
    {
        const NumberStyles styles = NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint;
        if (delimiter == ';' && value.Contains(','))
        {
            return decimal.TryParse(value, styles, CultureInfo.GetCultureInfo("hu-HU"), out result);
        }

        return decimal.TryParse(value, styles, CultureInfo.InvariantCulture, out result);
    }

    private static string GetColumn(
        IReadOnlyList<string> columns,
        IReadOnlyDictionary<string, int> indexes,
        string field)
    {
        var index = indexes[field];
        return index < columns.Count ? columns[index] : string.Empty;
    }

    internal static IReadOnlyList<string> ParseLine(string line, char delimiter, int rowNumber)
    {
        var fields = new List<string>();
        var current = new StringBuilder();
        var insideQuotes = false;

        for (var index = 0; index < line.Length; index++)
        {
            var character = line[index];
            if (character == '"')
            {
                if (insideQuotes && index + 1 < line.Length && line[index + 1] == '"')
                {
                    current.Append('"');
                    index++;
                }
                else
                {
                    insideQuotes = !insideQuotes;
                }
            }
            else if (character == delimiter && !insideQuotes)
            {
                fields.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(character);
            }
        }

        if (insideQuotes)
        {
            throw new VatFileValidationException(
                [new ValidationError(rowNumber, "file", "Unclosed quoted field.")]);
        }

        fields.Add(current.ToString());
        return fields;
    }

    private static void RejectNullBytes(string value)
    {
        if (value.Contains('\0'))
        {
            throw InvalidFile("file", "Binary content is not accepted.");
        }
    }

    private static VatFileValidationException InvalidFile(string field, string message) =>
        new([new ValidationError(null, field, message)]);
}
