using System.Net;
using System.Net.Http.Json;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using Kiberaz.Application.DTOs.Auth;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Exam;
using Kiberaz.Application.DTOs.Quiz;
using Kiberaz.Application.DTOs.User;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Enums;
using Kiberaz.Infrastructure.Data;
using Kiberaz.Infrastructure.Identity;
using Kiberaz.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using PdfSharp.Pdf;

namespace Kiberaz.SecurityRegressionTests;

internal static partial class Program
{
    private static async Task RunRemediationTests(HttpClient client, Func<LiteDbContext> openDb,
        Dictionary<string, AppUser> accounts, Dictionary<string, string> tokens, string sandbox)
    {
        Console.WriteLine("Checking remediation attack paths and legitimate controls.");
        using var db = openDb();
        var student = NewUser("remediation", AppRoles.User);
        db.Users.Insert(student);
        var studentToken = MakeToken(student);
        var quiz = new QuizService(db);
        var categoryId = db.QuizCategories.FindAll().First().Id;
        CreateQuizQuestionRequest Question(string text, bool secret = false) => new()
        {
            CategoryId = categoryId, Difficulty = "Başlanğıc", Question = text, IsExamOnly = secret,
            CorrectKey = "B", Options = new[] { "A", "B", "C", "D" }.Select(k =>
                new CreateQuizOptionRequest { Key = k, Text = "Choice " + k, Explanation = "Explanation " + k }).ToList()
        };
        var publicQuestion = await quiz.CreateQuestionAsync(Question("Public practice security fixture"));
        var privateQuestion = await quiz.CreateQuestionAsync(Question("Private exam security fixture", true));
        var response = await Send(client, new("POST", "/api/quiz/submit"), studentToken,
            body: new { questionId = publicQuestion.Id, selectedKey = "A" });
        Expect(response, HttpStatusCode.OK, "first practice answer accepted");
        response.Dispose();
        var replays = await Task.WhenAll(Enumerable.Range(0, 12).Select(_ =>
            Send(client, new("POST", "/api/quiz/submit"), studentToken,
                body: new { questionId = publicQuestion.Id, selectedKey = "B" })));
        foreach (var replay in replays) { Expect(replay, HttpStatusCode.OK, "practice replay stays usable"); replay.Dispose(); }
        var recorded = db.QuizResults.Find(r => r.UserId == student.Id && r.QuestionId == publicQuestion.Id).ToList();
        Check(recorded.Count == 1 && !recorded[0].IsCorrect, "replay/concurrency cannot replace first answer or add score");
        var leaders = await quiz.GetLeaderboardAsync("all", null, 100);
        Check(leaders.Single(e => e.Name == student.Nickname).Score == 0, "wrong-then-correct replay earns no points");
        // An old duplicate must not become a new first answer in a different period.
        recorded[0].AnsweredAt = DateTime.UtcNow.AddDays(-40);
        db.QuizResults.Update(recorded[0]);
        db.QuizResults.Insert(new QuizResult { UserId = student.Id, QuestionId = publicQuestion.Id,
            CategoryId = categoryId, IsCorrect = true, AnsweredAt = DateTime.UtcNow });
        Check(!(await quiz.GetLeaderboardAsync("weekly", null, 100)).Any(e => e.Name == student.Nickname),
            "legacy replays deduplicated before weekly window");
        var correctQuestion = await quiz.CreateQuestionAsync(Question("Correct first answer fixture"));
        using (var correct = await Send(client, new("POST", "/api/quiz/submit"), studentToken,
            body: new { questionId = correctQuestion.Id, selectedKey = "B" }))
            Expect(correct, HttpStatusCode.OK, "correct first answer accepted");
        Check((await quiz.GetLeaderboardAsync("all", null, 100)).Single(e => e.Name == student.Nickname).Score == 5,
            "legitimate correct first answer earns exactly five points");

        using (var list = await client.GetAsync($"/api/quiz/questions?categoryId={categoryId}&count=50"))
        {
            var json = await list.Content.ReadAsStringAsync();
            Check(!json.Contains(privateQuestion.Question), "anonymous public list excludes private questions");
            Check(json.Contains(publicQuestion.Question), "public practice list preserved");
        }
        foreach (var token in new string?[] { null, studentToken, tokens[AppRoles.Admin] })
        {
            using var hidden = await Send(client, new("POST", "/api/quiz/submit"), token,
                body: new { questionId = privateQuestion.Id, selectedKey = "A" });
            Expect(hidden, HttpStatusCode.BadRequest, "private answer oracle blocked for every submit caller");
            Check(!(await hidden.Content.ReadAsStringAsync()).Contains("correctKey"), "private answer never serialized");
        }
        await Reject<ArgumentException>(() => quiz.CreateQuestionAsync(Question("  PUBLIC   practice security fixture ", true)),
            "normalized public copy cannot become private");
        await Reject<ArgumentException>(() => quiz.CreateQuestionAsync(Question(privateQuestion.Question)),
            "private copy cannot be published");
        var importAssembly = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..",
            "ImportQuestionsTool", "debug", "ImportQuestionsTool.dll"));
        if (!File.Exists(importAssembly)) throw new InvalidOperationException("Run tests with the documented --artifacts-path.");
        async Task<int> Import(string text, bool secret, bool dryRun = false)
        {
            var file = Path.Combine(sandbox, "import-fixture.json");
            await File.WriteAllTextAsync(file, JsonSerializer.Serialize(new[] { Question(text, secret) }));
            var start = new System.Diagnostics.ProcessStartInfo("dotnet")
            {
                WorkingDirectory = sandbox, UseShellExecute = false, CreateNoWindow = true,
                WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden,
                RedirectStandardOutput = true, RedirectStandardError = true
            };
            foreach (var arg in new[] { importAssembly, "--db", Path.Combine(sandbox, "security.db"), "--file", file })
                start.ArgumentList.Add(arg);
            if (dryRun) start.ArgumentList.Add("--dry-run");
            using var process = System.Diagnostics.Process.Start(start) ?? throw new Exception();
            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();
            await Task.WhenAll(stdout, stderr);
            return process.ExitCode;
        }
        var beforeImport = db.QuizQuestions.Count();
        Check(await Import(publicQuestion.Question, true) == 1 && db.QuizQuestions.Count() == beforeImport,
            "import cannot reclassify public question as private");
        Check(await Import("Fresh private import fixture", true, dryRun: true) == 0 && db.QuizQuestions.Count() == beforeImport,
            "private import dry-run leaves bank unchanged");
        Check(await Import("Fresh private import fixture", true) == 0 && db.QuizQuestions.Count() == beforeImport + 1,
            "fresh private question import succeeds");
        Check(await Import("Fresh private import fixture", true) == 0 && db.QuizQuestions.Count() == beforeImport + 1,
            "repeated import is idempotent");
        Check(!(await quiz.GetQuestionsAsync(categoryId, count: 50)).Any(q => q.Question == "Fresh private import fixture"),
            "imported private question not exposed publicly");
        var teacher = NewUser("examteacher", AppRoles.Teacher);
        db.Users.Insert(teacher);
        var exams = new ExamSessionService(db, TimeProvider.System);
        var session = exams.Create(teacher.Id, new CreateExamRequest("Private fixture exam", 10,
            [new ExamCategorySelection(categoryId, 1)]));
        var attempt = exams.Join(student.Id, session.Code);
        Check(attempt.Questions.Count == 1 && (attempt.Questions[0].Text == privateQuestion.Question ||
            attempt.Questions[0].Text == "Fresh private import fixture"),
            "exam uses private bank exclusively");
        var saved = exams.SaveAnswer(student.Id, attempt.Id,
            new SaveExamAnswerRequest(attempt.Questions[0].Id, "B", attempt.Revision));
        var result = exams.Submit(student.Id, attempt.Id);
        Check(result.CorrectCount == 1 && result.Percentage == 100, "legitimate private exam grades correctly");
        var legacy = new ExamSession { Code = "KBR-0123456789ABCDEF", TeacherId = teacher.Id,
            Title = "Exposed legacy exam", DurationMinutes = 10 };
        db.ExamSessions.Insert(legacy);
        await Reject<ExamRequestException>(() => Task.FromResult(exams.Join(student.Id, legacy.Code)),
            "legacy exposed exam rejects new participation");

        // Exercise real anonymous endpoint and assert it cannot mutate victim recovery state.
        var stamp = db.Users.FindById(student.Id).ConcurrencyStamp;
        for (var i = 0; i < 7; i++)
        {
            using var badReset = await client.PostAsJsonAsync("/api/auth/reset-password", new
            { userId = student.Id, token = "bogus" + i, newPassword = Password, confirmPassword = Password });
            Expect(badReset, HttpStatusCode.BadRequest, "invalid reset token rejected");
        }
        var after = db.Users.FindById(student.Id);
        Check(after.ConcurrencyStamp == stamp && after.PasswordResetLockoutEnd is null &&
            after.PasswordResetFailedAttempts == 0, "bogus resets never write victim state");

        // Both candidate emails with a known nickname return the same response.
        async Task<(HttpStatusCode Status, string Body)> Register(string email)
        {
            using var res = await client.PostAsJsonAsync("/api/auth/register", new
            { firstName = "Fixture", lastName = "Tester", gender = 0, role = "User",
              nickname = student.Nickname, email, password = Password, confirmPassword = Password });
            return (res.StatusCode, await res.Content.ReadAsStringAsync());
        }
        var existing = await Register(student.Email!);
        var missing = await Register("missing@example.invalid");
        Check(existing == missing, "existing nickname cannot distinguish existing and missing emails");

        await CheckAccountServices(sandbox);
        await CheckUploadServices(sandbox);
        foreach (var active in new[] { false, true })
        {
            using var form = new MultipartFormDataContent();
            form.Add(new ByteArrayContent(PdfFixture(active)), "file", "fixture.pdf");
            using var upload = await client.PostAsync("/api/upload/syllabus", form);
            Expect(upload, active ? HttpStatusCode.BadRequest : HttpStatusCode.OK,
                active ? "anonymous active PDF upload blocked" : "anonymous safe PDF upload preserved through worker");
        }
        // Existing PDFs must not be served directly by static files.
        var syllabus = Path.Combine(sandbox, "wwwroot", "uploads", "syllabus");
        Directory.CreateDirectory(syllabus);
        var badName = Guid.NewGuid().ToString("N") + ".pdf";
        await File.WriteAllBytesAsync(Path.Combine(syllabus, badName), PdfFixture(true));
        using (var download = await client.GetAsync("/uploads/syllabus/" + badName))
            Expect(download, HttpStatusCode.NotFound, "legacy active PDF blocked at download boundary");
        var goodName = Guid.NewGuid().ToString("N") + ".pdf";
        await File.WriteAllBytesAsync(Path.Combine(syllabus, goodName), PdfFixture(false));
        using (var download = await client.GetAsync("/uploads/syllabus/" + goodName))
        {
            Expect(download, HttpStatusCode.OK, "legacy static PDF remains downloadable");
            Check(download.Content.Headers.ContentDisposition?.DispositionType == "attachment", "PDF forced download");
        }
    }

    private static async Task CheckAccountServices(string sandbox)
    {
        var root = Path.Combine(sandbox, "accounts");
        Directory.CreateDirectory(root);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:LiteDb"] = "Filename=" + Path.Combine(root, "accounts.db"),
            ["JwtSettings:SecretKey"] = SigningKey, ["JwtSettings:Issuer"] = Issuer, ["JwtSettings:Audience"] = Audience
        }).Build();
        var email = new CapturedEmail();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(root, "keys")))
            .SetApplicationName("remediation-tests");
        services.AddSingleton<IConfiguration>(config);
        services.AddSingleton<IHostEnvironment>(new TestEnvironment(root));
        services.AddSingleton<LiteDbContext>();
        services.AddHttpContextAccessor();
        services.AddIdentity<AppUser, AppRole>().AddUserStore<LiteDbUserStore>().AddRoleStore<LiteDbRoleStore>()
            .AddDefaultTokenProviders();
        services.AddSingleton<IEmailService>(email);
        services.AddSingleton<ICaptchaService, RejectCaptcha>();
        services.AddSingleton<IAttemptTracker, InMemoryAttemptTracker>();
        services.AddSingleton<TokenService>();
        services.AddSingleton<ProtectedAccountPolicy>();
        services.AddScoped<AuthService>();
        services.AddScoped<UserService>();
        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var manager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var db = scope.ServiceProvider.GetRequiredService<LiteDbContext>();
        var auth = scope.ServiceProvider.GetRequiredService<AuthService>();
        var userService = scope.ServiceProvider.GetRequiredService<UserService>();
        var http = scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>();
        http.HttpContext = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        var user = NewUser("accountfixture", AppRoles.User);
        user.PasswordResetLockoutEnd = DateTime.UtcNow.AddDays(1); // Historical attacker-created lock.
        db.Users.Insert(user);
        var resetToken = await manager.GeneratePasswordResetTokenAsync(user);
        var changed = await auth.ResetPasswordAsync(new ResetPasswordRequest
        { UserId = user.Id, Token = resetToken, NewPassword = "Replacement123!", ConfirmPassword = "Replacement123!" });
        Check(changed.Success, "valid recovery token works even with historical reset lock");
        var refreshed = await manager.FindByIdAsync(user.Id) ?? throw new Exception();
        Check(await manager.CheckPasswordAsync(refreshed, "Replacement123!"), "legitimate reset changes password");
        var replay = await auth.ResetPasswordAsync(new ResetPasswordRequest
        { UserId = user.Id, Token = resetToken, NewPassword = Password, ConfirmPassword = Password });
        Check(!replay.Success, "used recovery token remains single-use");

        const string target = "new-mailbox@example.invalid";
        var requested = await userService.RequestEmailChangeAsync(user.Id, new ChangeEmailRequest { NewEmail = target });
        Check(requested.Success && email.ChangeToken is not null, "email change requires old-mailbox token");
        var oldStamp = db.Users.FindById(user.Id).SecurityStamp;
        var invalid = await userService.ConfirmEmailChangeAsync(user.Id, target, "invalid");
        Check(!invalid.Success && db.Users.FindById(user.Id).Email == user.Email, "invalid email token leaves email intact");
        var confirmed = await userService.ConfirmEmailChangeAsync(user.Id, target, email.ChangeToken!);
        Check(confirmed.Success, "old-mailbox confirmation accepted");
        var newState = db.Users.FindById(user.Id);
        Check(newState.Email == target && !newState.EmailConfirmed && newState.SecurityStamp != oldStamp &&
            newState.RefreshToken is null && newState.GoogleLoginCodeHash is null,
            "email, unconfirmed state and revocation committed together");
        Check(!(await userService.ConfirmEmailChangeAsync(user.Id, target, email.ChangeToken!)).Success,
            "old-mailbox change link cannot replay");
        var accepted = await auth.ConfirmEmailAsync(user.Id, email.ConfirmationToken!);
        Check(accepted.Success && db.Users.FindById(user.Id).EmailConfirmed, "new mailbox can complete confirmation");
    }

    private static async Task CheckUploadServices(string sandbox)
    {
        var root = Path.Combine(sandbox, "upload-tests");
        Directory.CreateDirectory(root);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["Uploads:MaxTotalBytes"] = "300", ["Uploads:MaxFiles"] = "4", ["Uploads:MinFreeBytes"] = "0" }).Build();
        var sanitizer = new PdfProcessSanitizer(typeof(Kiberaz.Api.Controllers.UploadController).Assembly.Location);
        var upload = new UploadService(new UploadEnvironment(root), config, sanitizer);
        var png = new byte[100];
        new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }.CopyTo(png, 0);
        var url = await upload.UploadFileAsync(new MemoryStream(png), "photo.png", "photos", [".png"], 100);
        Check(url.StartsWith("/uploads/photos/"), "legitimate anonymous image upload preserved");
        await upload.UploadFileAsync(new MemoryStream(png), "photo.png", "photos", [".png"], 100);
        await upload.UploadFileAsync(new MemoryStream(png), "photo.png", "photos", [".png"], 100);
        await Reject<UploadCapacityException>(() => upload.UploadFileAsync(new MemoryStream(png),
            "photo.png", "photos", [".png"], 100), "aggregate storage budget enforced");
        Check(Directory.GetFiles(Path.Combine(root, "wwwroot", "uploads", "photos")).Length == 3,
            "quota rejection leaves no extra files");
        var streamRoot = Path.Combine(sandbox, "upload-stream-tests");
        Directory.CreateDirectory(streamRoot);
        var streamUpload = new UploadService(new UploadEnvironment(streamRoot), config, sanitizer);
        await Reject<ArgumentException>(() => streamUpload.UploadFileAsync(new NonSeekable(png),
            "photo.png", "photos", [".png"], 50), "actual bytes bounded for nonseekable stream");
        var good = PdfFixture(false);
        Check(SafePdf.Rewrite(good, 100000).Length > 0, "ordinary PDF survives canonical rewrite");
        Check((await sanitizer.RewriteAsync(CompressedPdf(false), 100000)).Length > 0,
            "valid compressed-object PDF survives worker");
        await Reject<ArgumentException>(() => sanitizer.RewriteAsync(CompressedPdf(true), 100000),
            "escaped active name inside compressed object stream rejected");
        await Reject<ArgumentException>(() => Task.FromResult(SafePdf.Rewrite(PdfFixture(true), 100000)),
            "hex-escaped active PDF rejected by parser");
        await Reject<ArgumentException>(() => Task.FromResult(SafePdf.Rewrite("%PDF-malformed"u8.ToArray(), 100000)),
            "malformed PDF rejected");
        using var encrypted = new PdfDocument();
        encrypted.AddPage();
        encrypted.SecuritySettings.UserPassword = "locked";
        using var encryptedBytes = new MemoryStream();
        encrypted.Save(encryptedBytes, false);
        await Reject<ArgumentException>(() => Task.FromResult(SafePdf.Rewrite(encryptedBytes.ToArray(), 100000)),
            "encrypted PDF cannot bypass inspection");
    }

    private static byte[] PdfFixture(bool active)
    {
        var objects = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R" + (active ? " /Open#41ction 4 0 R" : "") + " >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>",
        };
        if (active) objects.Add("<< /S /Java#53cript /J#53 (void 0) >>"); // inert marker, never executed.
        var result = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var i = 0; i < objects.Count; i++)
        {
            offsets.Add(Encoding.ASCII.GetByteCount(result.ToString()));
            result.Append($"{i + 1} 0 obj\n{objects[i]}\nendobj\n");
        }
        var xref = Encoding.ASCII.GetByteCount(result.ToString());
        result.Append($"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets) result.Append($"{offset:D10} 00000 n \n");
        result.Append($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return Encoding.ASCII.GetBytes(result.ToString());
    }

    private static byte[] CompressedPdf(bool active)
    {
        using var pdf = new MemoryStream();
        void Text(string text) => pdf.Write(Encoding.ASCII.GetBytes(text));
        var offsets = new long[7];
        Text("%PDF-1.5\n");
        void Obj(int id, string body)
        { offsets[id] = pdf.Position; Text($"{id} 0 obj\n{body}\nendobj\n"); }
        Obj(1, "<< /Type /Catalog /Pages 2 0 R" + (active ? " /Open#41ction 4 0 R" : "") + " >>");
        Obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
        Obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>");
        var objectBytes = Encoding.ASCII.GetBytes("4 0 " + (active
            ? "<< /S /Java#53cript /J#53 (void 0) >>" : "<< /Producer (Security fixture) >>"));
        using var compressed = new MemoryStream();
        using (var zip = new ZLibStream(compressed, CompressionLevel.Optimal, leaveOpen: true)) zip.Write(objectBytes);
        offsets[5] = pdf.Position;
        Text($"5 0 obj\n<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length {compressed.Length} >>\nstream\n");
        pdf.Write(compressed.ToArray()); Text("\nendstream\nendobj\n");
        offsets[6] = pdf.Position;
        using var xref = new MemoryStream();
        for (var id = 0; id < 7; id++)
        {
            xref.WriteByte(id == 0 ? (byte)0 : id == 4 ? (byte)2 : (byte)1);
            var value = id == 4 ? 5 : offsets[id];
            for (var shift = 24; shift >= 0; shift -= 8) xref.WriteByte((byte)(value >> shift));
            xref.WriteByte(id == 0 ? (byte)255 : (byte)0);
            xref.WriteByte(id == 0 ? (byte)255 : (byte)0);
        }
        Text($"6 0 obj\n<< /Type /XRef /Size 7 /Root 1 0 R /W [1 4 2] /Length {xref.Length}" +
            (active ? "" : " /Info 4 0 R") + " >>\nstream\n");
        pdf.Write(xref.ToArray()); Text($"\nendstream\nendobj\nstartxref\n{offsets[6]}\n%%EOF\n");
        return pdf.ToArray();
    }

    private static async Task Reject<T>(Func<Task> action, string label) where T : Exception
    {
        try { await action(); Check(false, label); }
        catch (T) { Check(true, label); }
    }
    private sealed class RejectCaptcha : ICaptchaService
    {
        public Task<bool> VerifyAsync(string token, string? remoteIp = null) => Task.FromResult(false);
    }
    private sealed class CapturedEmail : IEmailService
    {
        public string? ChangeToken { get; private set; }
        public string? ConfirmationToken { get; private set; }
        public Task<ApiResponse<bool>> SendConfirmationEmailAsync(string email, string user, string token)
        { ConfirmationToken = token; return Task.FromResult(ApiResponse<bool>.Ok(true)); }
        public Task<ApiResponse<bool>> SendPasswordResetEmailAsync(string email, string user, string token)
            => Task.FromResult(ApiResponse<bool>.Ok(true));
        public Task<ApiResponse<bool>> SendEmailChangeConfirmationAsync(string email, string user, string target, string token)
        { ChangeToken = token; return Task.FromResult(ApiResponse<bool>.Ok(true)); }
    }
    private sealed class UploadEnvironment(string root) : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "SecurityTests";
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ContentRootPath { get; set; } = root;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = Path.Combine(root, "wwwroot");
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    }
    private sealed class NonSeekable(byte[] bytes) : MemoryStream(bytes)
    {
        public override bool CanSeek => false;
        public override long Length => throw new NotSupportedException();
    }
}
