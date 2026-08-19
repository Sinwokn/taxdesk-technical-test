using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http.Features;
using TaxDesk.Api.Features.VatReports;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddSingleton<CsvVatReportParser>();
builder.Services.AddSingleton<VatReportService>();
builder.Services.AddSingleton<SimplePdfGenerator>();

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = CsvVatReportParser.MaximumFileSizeBytes + 64 * 1024;
    options.ValueLengthLimit = 16 * 1024;
    options.MultipartHeadersLengthLimit = 8 * 1024;
});

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = CsvVatReportParser.MaximumFileSizeBytes + 64 * 1024;
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("file-uploads", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

var frontendOrigin = builder.Configuration["FrontendOrigin"] ?? "http://localhost:5173";
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.WithOrigins(frontendOrigin)
            .WithMethods("GET", "POST")
            .WithHeaders("Content-Type"));
});

var app = builder.Build();

app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "no-referrer");
    context.Response.Headers.Append("Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
    context.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    await next();
});

app.UseCors("frontend");
app.UseRateLimiter();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapPost("/api/vat-reports", async (
        HttpRequest request,
        VatReportService service,
        CancellationToken cancellationToken) =>
    {
        var fileResult = await ReadAndValidateFileAsync(request, cancellationToken);
        if (fileResult.Error is not null)
        {
            return fileResult.Error;
        }

        try
        {
            await using var stream = fileResult.File!.OpenReadStream();
            var report = await service.CreateAsync(
                stream,
                Path.GetFileName(fileResult.File.FileName),
                cancellationToken);
            return Results.Ok(report);
        }
        catch (VatFileValidationException exception)
        {
            return ValidationProblem(exception);
        }
    })
    .RequireRateLimiting("file-uploads")
    .DisableAntiforgery();

app.MapPost("/api/vat-reports/pdf", async (
        HttpRequest request,
        VatReportService service,
        SimplePdfGenerator pdfGenerator,
        CancellationToken cancellationToken) =>
    {
        var fileResult = await ReadAndValidateFileAsync(request, cancellationToken);
        if (fileResult.Error is not null)
        {
            return fileResult.Error;
        }

        try
        {
            await using var stream = fileResult.File!.OpenReadStream();
            var report = await service.CreateAsync(
                stream,
                Path.GetFileName(fileResult.File.FileName),
                cancellationToken);
            var pdf = pdfGenerator.Generate(report);
            return Results.File(pdf, "application/pdf", "vat-declaration-summary.pdf");
        }
        catch (VatFileValidationException exception)
        {
            return ValidationProblem(exception);
        }
    })
    .RequireRateLimiting("file-uploads")
    .DisableAntiforgery();

app.MapFallbackToFile("index.html");

app.Run();

static async Task<(IFormFile? File, IResult? Error)> ReadAndValidateFileAsync(
    HttpRequest request,
    CancellationToken cancellationToken)
{
    if (!request.HasFormContentType)
    {
        return (null, Results.Problem(
            statusCode: StatusCodes.Status415UnsupportedMediaType,
            title: "Expected multipart form data."));
    }

    IFormCollection form;
    try
    {
        form = await request.ReadFormAsync(cancellationToken);
    }
    catch (InvalidDataException)
    {
        return (null, Results.Problem(
            statusCode: StatusCodes.Status413PayloadTooLarge,
            title: "The uploaded file is too large."));
    }

    if (form.Files.Count != 1)
    {
        return (null, Results.BadRequest(new
        {
            title = "Exactly one CSV file is required."
        }));
    }

    var file = form.Files[0];
    var extension = Path.GetExtension(file.FileName);
    if (!extension.Equals(".csv", StringComparison.OrdinalIgnoreCase))
    {
        return (null, Results.BadRequest(new
        {
            title = "Only .csv files are accepted."
        }));
    }

    if (file.Length is <= 0 or > CsvVatReportParser.MaximumFileSizeBytes)
    {
        return (null, Results.BadRequest(new
        {
            title = $"The CSV file must be between 1 byte and {CsvVatReportParser.MaximumFileSizeBytes / 1024 / 1024} MB."
        }));
    }

    return (file, null);
}

static IResult ValidationProblem(VatFileValidationException exception) =>
    Results.Json(
        new
        {
            title = "The CSV file could not be processed.",
            status = StatusCodes.Status422UnprocessableEntity,
            errors = exception.Errors
        },
        statusCode: StatusCodes.Status422UnprocessableEntity);

public partial class Program;
