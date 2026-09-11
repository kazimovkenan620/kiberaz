# Quiz Authoring Quality Pipeline

Use this process when turning supplied material into Kiberaz.az quiz seed data.

## 1. Assess coverage

Estimate the material's sections, pages, structured topics, and knowledge density. Establish a realistic target range rather than an artificial fixed count. For long material, process in coherent chunks while continuing the authorized task; provide progress updates instead of repeatedly blocking for confirmation.

For each topic, look for independent knowledge atoms across:

- definition and purpose;
- mechanism and sequence;
- comparison with neighboring concepts;
- protocol, format, port, flag, or numeric property;
- attack prerequisite and exploitation path;
- defense and detection;
- tool, command, output, and interpretation;
- common misconception;
- practical scenario and consequence.

Do not invent coverage where the material provides no reliable basis. Supplementary general knowledge may be used only when the user requests it or when the supplied source explicitly expects standard prerequisite knowledge.

## 2. Build a coverage map

For structured systems such as OSI layers, TCP/IP layers, DHCP DORA, a handshake, a kill chain, or a multi-stage incident workflow, list every component and ensure each material-supported component is tested at least once. Add comparison and ordering questions only when they test a separate knowledge atom.

Track atoms as:

- converted into a question;
- used as a distractor or explanation;
- skipped because it is unsupported, outside active categories, duplicative, ambiguous, or cannot support a fair four-option question.

## 3. Define the question family

Before writing options, identify the narrowest technical family that contains the answer. Examples include DORA steps, TCP flags, ARP message behavior, XSS variants, authentication controls, or SIEM triage stages.

If four plausible choices cannot be produced inside that family, reformulate the question or carefully widen the family. Do not combine unrelated protocols merely to fill option slots.

## 4. Construct the answer universe

Options should have comparable grammar, specificity, and approximate length. Prefer distractors in this order:

1. another member of the same sequence or family;
2. a neighboring mechanism commonly confused with the answer;
3. a technically true responsibility of a closely related control that does not answer this question.

Avoid absurd choices, giveaway wording, unmatched detail, overlapping correct answers, absolutes that make elimination easy, and a visibly longer correct option.

## 5. Engineer explanations

For the correct option, explain the mechanism and the decisive detail that makes it the answer. For each incorrect option, state what the option actually describes, why it does not satisfy this question, and one useful related fact.

Keep explanations concise enough for quiz feedback while retaining technical precision. Do not mention the authoring process or say “materialda belədir”.

## 6. Calibrate difficulty

- `Başlanğıc`: terminology, definition, primary purpose, direct identification.
- `Orta`: practical application, sequence interpretation, cause and effect, choosing a control or tool.
- `Peşəkar`: multi-signal analysis, architecture trade-offs, exploit/defense chains, prioritization, or subtle protocol behavior.

Use an approximate 40/40/20 Beginner/Intermediate/Expert distribution only as a collection-level guideline. Let the material's real depth override the ratio.

## 7. Quality gate for every question

Reject or revise the question unless all are true:

1. It tests one unambiguous knowledge atom.
2. Exactly one option answers the precise wording.
3. All four options belong to a defensible common family.
4. Options are grammatically parallel and similarly specific.
5. The answer cannot be found through obvious formatting or absurd-option elimination.
6. Every explanation teaches accurate, relevant information.
7. Category and difficulty match the live repository contract.
8. The correct key contributes to a balanced A/B/C/D distribution.
9. The question is not a semantic duplicate of the existing bank or the current batch.
10. Azerbaijani grammar and terminology are clear and consistent.

## 8. Final validation and report

Parse the final JSON and verify every new object's schema. Check that each category ID exists in `quiz-categories.json`, option keys are exactly A/B/C/D, `correctKey` resolves to one option, and all required strings are non-empty.

Report:

- total questions added;
- counts by category and difficulty;
- topic/structured-component coverage;
- skipped atoms and their reasons;
- any category-topic metadata changed;
- the JSON validation result.
