using System.Globalization;
using System.Text;

namespace TaxDesk.Api.Features.VatReports;

public sealed class SimplePdfGenerator
{
    public byte[] Generate(VatReport report)
    {
        var content = BuildPageContent(report);
        var objects = new[]
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
            "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
            $"<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}\nendstream"
        };

        using var stream = new MemoryStream();
        using var writer = new StreamWriter(stream, Encoding.ASCII, leaveOpen: true)
        {
            NewLine = "\n"
        };

        writer.WriteLine("%PDF-1.4");
        writer.WriteLine("%TaxDesk VAT summary");
        writer.Flush();

        var offsets = new List<long> { 0 };
        for (var index = 0; index < objects.Length; index++)
        {
            offsets.Add(stream.Position);
            writer.WriteLine($"{index + 1} 0 obj");
            writer.WriteLine(objects[index]);
            writer.WriteLine("endobj");
            writer.Flush();
        }

        var crossReferenceOffset = stream.Position;
        writer.WriteLine("xref");
        writer.WriteLine($"0 {objects.Length + 1}");
        writer.WriteLine("0000000000 65535 f ");
        foreach (var offset in offsets.Skip(1))
        {
            writer.WriteLine($"{offset:0000000000} 00000 n ");
        }

        writer.WriteLine("trailer");
        writer.WriteLine($"<< /Size {objects.Length + 1} /Root 1 0 R >>");
        writer.WriteLine("startxref");
        writer.WriteLine(crossReferenceOffset);
        writer.WriteLine("%%EOF");
        writer.Flush();

        return stream.ToArray();
    }

    private static string BuildPageContent(VatReport report)
    {
        var content = new StringBuilder();
        AddText(content, 50, 790, 19, "F2", "Hungarian VAT Declaration Summary");
        AddText(content, 50, 766, 9, "F1", $"Generated: {report.GeneratedAtUtc:yyyy-MM-dd HH:mm} UTC");
        AddText(content, 50, 750, 9, "F1", $"Source: {Sanitize(report.SourceFileName)}");
        AddText(content, 50, 734, 9, "F1", $"Period: {report.DateFrom:yyyy-MM-dd} to {report.DateTo:yyyy-MM-dd}");
        AddText(content, 50, 718, 9, "F1", $"Transactions: {report.TransactionCount}");

        DrawLine(content, 50, 700, 545, 700);
        AddText(content, 50, 682, 9, "F2", "VAT rate");
        AddText(content, 130, 682, 9, "F2", "Items");
        AddText(content, 205, 682, 9, "F2", "Net (HUF)");
        AddText(content, 330, 682, 9, "F2", "VAT (HUF)");
        AddText(content, 445, 682, 9, "F2", "Gross (HUF)");
        DrawLine(content, 50, 672, 545, 672);

        var y = 652;
        foreach (var category in report.Categories)
        {
            AddText(content, 50, y, 9, "F1", $"{category.VatRate:0.##}%");
            AddText(content, 130, y, 9, "F1", category.TransactionCount.ToString(CultureInfo.InvariantCulture));
            AddRightAlignedText(content, 300, y, FormatMoney(category.NetAmount));
            AddRightAlignedText(content, 420, y, FormatMoney(category.VatAmount));
            AddRightAlignedText(content, 545, y, FormatMoney(category.GrossAmount));
            y -= 24;
        }

        DrawLine(content, 50, y + 10, 545, y + 10);
        y -= 10;
        AddText(content, 50, y, 10, "F2", "TOTAL");
        AddRightAlignedText(content, 300, y, FormatMoney(report.Totals.NetAmount), "F2", 10);
        AddRightAlignedText(content, 420, y, FormatMoney(report.Totals.VatAmount), "F2", 10);
        AddRightAlignedText(content, 545, y, FormatMoney(report.Totals.GrossAmount), "F2", 10);

        AddText(content, 50, 90, 8, "F1", "Generated from validated CSV data. Amounts are rounded per transaction to 2 decimals.");
        AddText(content, 50, 76, 8, "F1", "This summary is not a substitute for an official NAV submission form.");
        return content.ToString();
    }

    private static void AddText(StringBuilder content, int x, int y, int size, string font, string text)
    {
        content.AppendLine($"BT /{font} {size} Tf 1 0 0 1 {x} {y} Tm ({Escape(text)}) Tj ET");
    }

    private static void AddRightAlignedText(
        StringBuilder content,
        int rightX,
        int y,
        string text,
        string font = "F1",
        int size = 9)
    {
        var approximateWidth = text.Length * size * 0.52;
        AddText(content, (int)(rightX - approximateWidth), y, size, font, text);
    }

    private static void DrawLine(StringBuilder content, int x1, int y1, int x2, int y2)
    {
        content.AppendLine($"0.65 G 0.6 w {x1} {y1} m {x2} {y2} l S");
    }

    private static string FormatMoney(decimal value) =>
        value.ToString("N2", CultureInfo.GetCultureInfo("en-US"));

    private static string Sanitize(string value) =>
        new(value.Select(character => character is >= ' ' and <= '~' ? character : '?').ToArray());

    private static string Escape(string value) =>
        Sanitize(value)
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("(", "\\(", StringComparison.Ordinal)
            .Replace(")", "\\)", StringComparison.Ordinal);
}
