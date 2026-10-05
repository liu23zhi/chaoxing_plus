# Agent Instructions

## Product Branding

- The user-visible product name is `超星学习助手`.
- Update every user-visible title when branding changes, including popup document titles, popup headings, floating panel headers, debug/log panel titles, dialog titles, and documentation headings.
- Do not leave legacy visible labels such as `Chaoxing Plus`, `ChaoXing Plus`, or `Pink Console` in UI titles.
- Internal identifiers are not visible titles and may retain their existing names unless explicitly requested: script filenames, storage keys, dataset keys, CSS selectors, and diagnostic log prefixes such as `[Chaoxing Plus]`.
- Before completing a branding change, search case-insensitively for legacy names and related visible-title strings, then update or add focused tests so the old visible title cannot return.
