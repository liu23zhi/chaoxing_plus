# Question Text Wrapping Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create an implementation plan after this design is approved.

**Goal:** Make long question text wrap automatically inside the existing panel UI so it never overflows the panel width.

**Architecture:** Keep the current inline-style rendering approach in `src/projects/common.ts` and add one tiny helper dedicated to question-text wrapping. Apply that helper only to question text render sites in the work-results detail area and question/cached-result list items.

**Tech Stack:** TypeScript, existing inline DOM style helpers, Node source-assertion tests.

---

## Scope

This change covers only question text displayed in the common panel UI:

1. The selected work-result question title in the detail panel.
2. The question text shown under answer candidates in tiku result lists.
3. Any same-file question-display nodes in the common panel that should follow the same wrapping behavior.

This change does **not**:

- change panel width or layout structure
- change answer text styling beyond what is already present
- introduce external CSS files or a new styling system

## Design

### 1. Add one focused helper for question text wrapping

In `src/projects/common.ts`, add a tiny helper that applies the wrapping rules used for question text nodes.

The helper should set:

- `whiteSpace = 'normal'`
- `overflowWrap = 'anywhere'`
- `wordBreak = 'break-word'`

This combination is intentionally minimal:

- `whiteSpace = 'normal'` allows regular multiline wrapping
- `overflowWrap = 'anywhere'` handles long no-space strings, tokens, and URLs
- `wordBreak = 'break-word'` keeps the behavior compatible with existing nodes that already rely on this style

### 2. Apply the helper to the selected work-result question title

The current selected question title is rendered in `createWorkResultDetail` at the title node near `result.question || '未识别题目'`.

After the existing font and color styles are applied, call the helper so long titles wrap within the panel instead of overflowing.

### 3. Apply the helper to tiku/cached question list items

The current tiku result question node already sets `wordBreak = 'break-word'` manually. Replace that one-off styling with the shared helper so all question render sites use the same rule set.

If the same file contains other question-display nodes in the common panel that are semantically “question text” rather than answer text or metadata, those nodes should use the same helper as part of this change.

## Testing

Keep testing minimal and aligned with the current project pattern.

Add or update a source-assertion test file so it verifies:

1. The wrapping helper exists in `src/projects/common.ts`.
2. The selected work-result question title uses that helper.
3. The tiku/cached question list item question text also uses that helper.
4. The helper includes `whiteSpace = 'normal'`, `overflowWrap = 'anywhere'`, and `wordBreak = 'break-word'`.

## Tradeoffs

### Recommended approach: tiny shared helper

**Why this is recommended:**
- smallest change that still keeps all question text behavior consistent
- avoids repeating the same three styles in multiple places
- stays aligned with the existing inline-style architecture

### Alternative: patch each node inline

This would be slightly more direct for one node, but it duplicates styling and makes future drift more likely if more question render sites are added.

### Alternative: widen the panel

This treats the symptom instead of the root UI issue and still fails on very long no-space strings.

## Success Criteria

- Long question text no longer overflows the panel width.
- Chinese text wraps naturally.
- Long English strings / tokens / URLs in question text can break instead of overflowing.
- The implementation remains confined to the existing common panel rendering code.
