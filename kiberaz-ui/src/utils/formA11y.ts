// ─── Forma əlçatanlığı köməkçiləri ────────────────────────────
// FormField ipucu və xətanı `${id}-hint` / `${id}-error` id-ləri ilə render edir;
// nəzarət elementinə bu funksiyanın nəticəsi `aria-describedby` kimi verilir.
export function describedBy(id: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids = [hasError ? `${id}-error` : '', hasHint ? `${id}-hint` : ''].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}
