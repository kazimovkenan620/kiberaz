using System.Diagnostics;

namespace Kiberaz.Infrastructure.Services;

// A malformed/decompression-heavy PDF must not take down the API process.
public sealed class PdfProcessSanitizer(string apiAssembly)
{
    public const int MaxBytes = 10 * 1024 * 1024;

    public async Task<byte[]> RewriteAsync(byte[] input, long maxBytes)
    {
        if (input.Length > maxBytes || maxBytes > MaxBytes) throw new ArgumentException("PDF çox böyükdür.");
        var executable = string.Equals(Path.GetFileNameWithoutExtension(Environment.ProcessPath),
            "dotnet", StringComparison.OrdinalIgnoreCase) ? Environment.ProcessPath! : "dotnet";
        var start = new ProcessStartInfo(executable)
        {
            UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true
        };
        start.ArgumentList.Add(apiAssembly);
        start.ArgumentList.Add("--sanitize-pdf");
        // PDF worker does not need inherited database, SMTP, JWT or cloud credentials.
        var keep = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { "PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "DOTNET_ROOT", "DOTNET_ROOT_X64" };
        foreach (var key in start.Environment.Keys.ToList())
            if (!keep.Contains(key)) start.Environment.Remove(key);
        start.Environment["DOTNET_GCHeapHardLimit"] = "10000000"; // 256 MiB, hexadecimal.
        start.Environment["DOTNET_gcServer"] = "0";
        start.Environment["DOTNET_EnableDiagnostics"] = "0";
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        using var process = Process.Start(start) ?? throw new ArgumentException("PDF yoxlana bilmədi.");
        async Task WriteInput()
        {
            await process.StandardInput.BaseStream.WriteAsync(input, timeout.Token);
            process.StandardInput.Close();
        }
        async Task Monitor()
        {
            while (!process.HasExited)
            {
                process.Refresh();
                if (process.WorkingSet64 > 512L * 1024 * 1024) throw new ArgumentException("PDF resurs limitini keçdi.");
                await Task.Delay(100, timeout.Token);
            }
        }
        var send = WriteInput();
        var output = ReadBoundedAsync(process.StandardOutput.BaseStream, (int)maxBytes, timeout.Token);
        var errors = ReadBoundedAsync(process.StandardError.BaseStream, 32768, timeout.Token);
        var exit = process.WaitForExitAsync(timeout.Token);
        var monitor = Monitor();
        var tasks = new Task[] { send, output, errors, exit, monitor };
        try
        {
            // Fail on the first fault rather than waiting for blocked pipes.
            var pending = tasks.ToList();
            while (pending.Count > 0)
            {
                var completed = await Task.WhenAny(pending);
                await completed;
                pending.Remove(completed);
            }
            if (process.ExitCode != 0 || output.Result.Length == 0) throw new ArgumentException();
            return output.Result;
        }
        catch
        {
            throw new ArgumentException("PDF etibarsızdır, aktiv məzmun daşıyır və ya yoxlama limitini keçir.");
        }
        finally
        {
            timeout.Cancel();
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync();
            try { await Task.WhenAll(tasks); } catch { /* All pipe tasks observed after child termination. */ }
        }
    }

    public static async Task<byte[]> ReadBoundedAsync(Stream input, int limit, CancellationToken cancellation = default)
    {
        using var output = new MemoryStream();
        var buffer = new byte[81920];
        int read;
        while ((read = await input.ReadAsync(buffer, cancellation)) > 0)
        {
            if (output.Length + read > limit) throw new ArgumentException("PDF çox böyükdür.");
            output.Write(buffer, 0, read);
        }
        return output.ToArray();
    }

    public static async Task RunWorkerAsync()
    {
        try
        {
            var input = await ReadBoundedAsync(Console.OpenStandardInput(), MaxBytes);
            var bytes = SafePdf.Rewrite(input, MaxBytes);
            await Console.OpenStandardOutput().WriteAsync(bytes);
        }
        catch { Environment.ExitCode = 1; }
    }
}
