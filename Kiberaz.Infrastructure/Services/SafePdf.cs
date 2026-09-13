using PdfSharp.Pdf;
using PdfSharp.Pdf.Advanced;
using PdfSharp.Pdf.IO;

namespace Kiberaz.Infrastructure.Services;

public static class SafePdf
{
    private static readonly HashSet<string> Forbidden = new(StringComparer.Ordinal)
    {
        "/JavaScript", "/JS", "/OpenAction", "/AA", "/Launch", "/EmbeddedFile", "/EmbeddedFiles",
        "/Filespec", "/EF", "/AF", "/AcroForm", "/XFA", "/RichMedia", "/RichMediaContent",
        "/3D", "/3DD", "/Movie", "/Sound", "/SubmitForm", "/ImportData", "/GoToE", "/GoToR",
        "/Rendition", "/SetOCGState", "/Encrypt", "/Collection"
    };

    public static byte[] Rewrite(byte[] bytes, long maxBytes)
    {
        try
        {
            using var stream = new MemoryStream(bytes, writable: false);
            using var pdf = PdfReader.Open(stream, PdfDocumentOpenMode.Modify);
            if (pdf.SecuritySettings.IsEncrypted || pdf.PageCount is < 1 or > 200)
                throw new ArgumentException();
            var seen = new HashSet<PdfItem>(ReferenceEqualityComparer.Instance);
            var pending = new Stack<PdfItem>(pdf.Internals.GetAllObjects());
            pending.Push(pdf.Internals.Catalog);
            var count = 0;
            while (pending.TryPop(out var item))
            {
                if (!seen.Add(item)) continue;
                if (++count > 100000) throw new ArgumentException();
                if (item is PdfReference reference) pending.Push(reference.Value);
                else if (item is PdfDictionary dictionary)
                {
                    foreach (var key in dictionary.Elements.Keys)
                    {
                        if (Forbidden.Contains(key)) throw new ArgumentException();
                        pending.Push(dictionary.Elements[key] ?? throw new ArgumentException());
                    }
                    // An action may omit /Type. /A and /Next always reference action dictionaries.
                    if (dictionary.Elements.ContainsKey("/A"))
                        ValidateActions(dictionary.Elements["/A"] ?? throw new ArgumentException());
                    // /Next is also used by outline/page structures; only follow it for actions.
                    if (dictionary.Elements.ContainsKey("/S") && dictionary.Elements.ContainsKey("/Next"))
                        ValidateActions(dictionary.Elements["/Next"] ?? throw new ArgumentException());
                    if (dictionary.Elements.GetName("/Type") == "/Action") ValidateActions(dictionary);
                }
                else if (item is PdfArray array)
                    foreach (var child in array.Elements) pending.Push(child);
                else if (item is PdfName name && Forbidden.Contains(name.Value)) throw new ArgumentException();
            }
            using var output = new MemoryStream();
            pdf.Save(output, closeStream: false);
            if (output.Length > maxBytes) throw new ArgumentException();
            return output.ToArray();
        }
        catch (Exception e) when (e is not OutOfMemoryException)
        {
            throw new ArgumentException("PDF etibarsızdır, şifrələnib və ya aktiv məzmun daşıyır. Statik PDF yükləyin.");
        }
    }

    private static void ValidateActions(PdfItem root)
    {
        var pending = new Stack<PdfItem>();
        var seen = new HashSet<PdfItem>(ReferenceEqualityComparer.Instance);
        pending.Push(root);
        while (pending.TryPop(out var item))
        {
            if (!seen.Add(item)) continue;
            if (seen.Count > 10000) throw new ArgumentException();
            if (item is PdfReference reference) pending.Push(reference.Value);
            else if (item is PdfArray array)
                foreach (var child in array.Elements) pending.Push(child);
            else if (item is PdfDictionary action)
            {
                var kind = action.Elements.GetName("/S");
                if (kind == "/URI")
                {
                    if (!Uri.TryCreate(action.Elements.GetString("/URI"), UriKind.Absolute, out var uri) ||
                        uri.Scheme is not ("https" or "http" or "mailto")) throw new ArgumentException();
                }
                else if (kind != "/GoTo") throw new ArgumentException();
                if (action.Elements.ContainsKey("/Next")) pending.Push(action.Elements["/Next"] ?? throw new ArgumentException());
            }
            else throw new ArgumentException();
        }
    }
}
