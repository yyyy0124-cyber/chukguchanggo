# 2026-09-10 validation

- Uniform: 52/70 vs 54/72 produces +2cm for both dimensions; 51.5 produces -0.5cm; negative input fails browser validation and stale output is hidden.
- Best11: all four formations have exactly 11 fields and matching position labels; example names, Unicode long names, random permutation and formation changes checked.
- Actual downloaded best11-chukguchanggo.png inspected: 900×1200 PNG, 3-5-2 positions and long Korean name rendered correctly. In-app download-event wait timed out, but file creation and visual inspection succeeded.
- Balance: 24 choices completed, 24 unique question pairs, summary and clipboard confirmation verified. Switching to tactics resets to question 1/6.
- Mobile: 390px viewport, no horizontal overflow; controls and outputs visually inspected. Viewport restored afterward.
- Legacy /#best11 and /#uniform navigate to standalone pages. /#balance-game also checked before release.
- Shared JS and homepage inline scripts parse successfully.
- Daily build preservation: 3 override outputs equal authored templates after newline normalization. Initial byte-level comparison failed only due to LF/CRLF differences.
- Analytics events contain only tool_id and action, no names, measurements or selected answers.

This release improves three tools; it does not establish AdSense approval or resolve every site-wide content issue. No AdSense review request submitted.
