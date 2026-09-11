---
name: quiz-question-engineering
description: Convert user-supplied cybersecurity learning material into validated, non-duplicative Azerbaijani quiz questions for the Kiberaz.az seed-data JSON format.
---

# Quiz Question Engineering

Create a broad, technically accurate learning bank from supplied material and integrate it into the repository's live seed-data contract.

## Read the live contract

Before authoring questions, inspect:

- `seed-data/quiz-categories.json` for currently valid category IDs, hidden/subcategory behavior, titles, and topics;
- `seed-data/quiz-questions.json` for the existing bank and duplicate detection;
- `seed-data/TEMPLATE.md` for the documented JSON shape;
- `Kiberaz.Infrastructure/Data/QuizSeeder.cs` and `Kiberaz.Domain/Entities/QuizQuestion.cs` when the schema is ambiguous.

Repository data and code override stale category lists in older command documentation. Never assume that only category IDs 2 and 3 exist.

For the full authoring and quality process, read [references/quality-pipeline.md](references/quality-pipeline.md).

## Required JSON shape

Each new item in `seed-data/quiz-questions.json` must contain:

- a valid `categoryId` present in the live categories file;
- `difficulty` equal to `Başlanğıc`, `Orta`, or `Peşəkar`;
- one clear Azerbaijani `question` that tests one primary knowledge atom;
- `correctKey` equal to exactly one of `A`, `B`, `C`, or `D`;
- exactly four options with unique ordered keys `A` through `D`;
- non-empty Azerbaijani `text` and a teaching-quality `explanation` for every option.

Do not add comments, trailing prose, or non-JSON content to the seed file.

## Authoring rules

- Extract as many distinct, useful questions as the material supports without manufacturing facts or padding the count.
- Group questions by the narrowest relevant topic family. Use distractors from the same answer universe and grammatical form.
- A distractor may be a correct fact about a neighboring concept, but it must be wrong for the exact question.
- Explanations must teach why the option does or does not answer the question and add relevant context; never use bare “doğrudur” or “yanlışdır”.
- Balance correct keys across the added set and use meta-options only rarely and when their logic is strictly true.
- Map difficulty to actual reasoning demand: recall for `Başlanğıc`, application for `Orta`, and multi-step analysis or prioritization for `Peşəkar`.
- Do not duplicate an existing question by paraphrasing it, swapping option order, or testing the same fact in the same context and difficulty.
- Preserve topic grouping in the JSON. Update category topics only when new material genuinely changes the visible grouping and preserve unrelated category fields.

## Integration and verification

1. Add the new objects to the existing JSON array without rewriting unrelated entries.
2. Parse both seed JSON files after editing.
3. Validate category existence, difficulty, option count and keys, `correctKey`, non-empty explanations, and normalized duplicate question text.
4. Inspect the diff to ensure only intended seed/category content changed.
5. Report the number added, category distribution, difficulty distribution, topic coverage, and skipped knowledge atoms with reasons.
