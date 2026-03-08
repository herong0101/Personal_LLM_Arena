---
name: web-uiux-hci
description: Design, review, and refine website UI/UX and human-computer interaction for landing pages, dashboards, product pages, forms, onboarding, navigation, and content-heavy sites. Use when Codex needs to improve usability, information architecture, interaction flows, accessibility, visual hierarchy, conversion paths, microcopy, or heuristic evaluation of a web interface from screenshots, mockups, code, product requirements, or verbal descriptions.
---

# Web UI/UX HCI

## Overview

Use this skill to turn vague website design requests into concrete interface decisions, critique existing flows, and propose changes that are grounded in usability rather than taste.
Favor explanations that connect each recommendation to user goals, business goals, and interaction cost.

## Workflow

1. Clarify the artifact and goal.
2. Identify the primary user, primary task, and success signal.
3. Inspect the current interface or requirements.
4. Diagnose the biggest usability and interaction risks first.
5. Propose prioritized changes with rationale and concrete examples.
6. When asked to implement, preserve the established visual system unless the user requests a redesign.

## Start With The Problem

Define these before suggesting UI changes:

- Primary user segment
- User intent on this page or flow
- One most important action
- Constraints: screen size, technical stack, brand, content density, accessibility, localization
- Success metric: completion rate, reduced confusion, faster scanning, higher conversion, fewer support tickets

If the request is underspecified, make reasonable assumptions and state them explicitly instead of blocking.

## Diagnose In This Order

Evaluate high-impact issues before visual polish:

1. Task clarity
Is it obvious what the page is for and what the user should do next?

2. Information hierarchy
Does the layout guide attention from headline to evidence to action without competing focal points?

3. Interaction flow
Are clicks, fields, states, and transitions minimal, predictable, and recoverable?

4. Feedback and system status
Does the interface confirm progress, loading, success, failure, and next steps?

5. Accessibility and inclusivity
Can users perceive, understand, and operate the interface with keyboard, assistive tech, low vision, and varied literacy?

6. Trust and comprehension
Does the UI reduce ambiguity around pricing, privacy, destructive actions, and data use?

7. Visual refinement
Only after the above: spacing, typography rhythm, color emphasis, icon use, illustration, motion.

## Output Format

Prefer responses with these sections when useful:

- Goal and assumptions
- Key issues ordered by severity or user impact
- Recommended changes
- Example revised structure, copy, or interaction
- Implementation notes for design or code teams

When reviewing an existing UI, distinguish:

- Observations: what is on screen
- Risks: why it may fail
- Changes: what to adjust
- Expected outcome: what should improve

## Design Heuristics

Apply these principles repeatedly:

- Make the primary action unmistakable.
- Reduce cognitive load by chunking, sequencing, and hiding non-critical detail.
- Keep recognition easier than recall.
- Prefer progressive disclosure over overwhelming users upfront.
- Keep forms and decision points as short as possible.
- Preserve consistency in labels, layout logic, and control behavior.
- Make errors easy to prevent, notice, and recover from.
- Use motion only to clarify cause, effect, and spatial change.
- Write interface copy that is specific, short, and action-oriented.

## Common Task Patterns

### Landing Pages

Prioritize value proposition clarity, proof, segmentation, and call-to-action placement.
If conversion is weak, inspect headline specificity, content order, trust signals, and CTA friction before changing visuals.

### Dashboards

Optimize for scanability, status awareness, comparison, and drill-down paths.
Reduce decorative clutter; emphasize trend, exception, and recommended next action.

### Forms and Onboarding

Minimize steps, explain why information is needed, and show progress.
Use inline validation, clear field grouping, and recovery paths for abandonment.

### Navigation and Information Architecture

Group by user mental model, not internal org structure.
Use labels users would actually search for or say aloud.

### Complex Interaction Flows

Map entry point, branching decisions, failure states, empty states, and exit states.
If the flow spans multiple screens, show the shortest successful path first.

## Working From Code Or Screenshots

When the user provides code, inspect structural causes behind UX problems:

- DOM order and heading structure
- Form labels and error handling
- Focus states and keyboard reachability
- Responsive breakpoints and overflow
- Copy density and CTA placement
- State handling for loading, empty, success, and error cases

When the user provides screenshots or mockups, avoid pretending to know hidden behavior.
Separate visible evidence from inferred behavior.

## Accessibility Baseline

Always check:

- Clear page and section headings
- Sufficient contrast for text and controls
- Keyboard-focus visibility
- Semantic labels for inputs and buttons
- Error messages tied to the affected field
- Motion or animation that does not block comprehension
- Mobile touch targets large enough to operate reliably

For a compact checklist and critique rubric, read [references/review-checklist.md](references/review-checklist.md).

## Response Style

Be concrete. Prefer prioritized recommendations over generic inspiration.
Tie every design suggestion to at least one of: faster comprehension, lower effort, lower risk, higher confidence, or stronger conversion.
When generating UI ideas, provide enough specificity that another engineer or designer could implement them without guessing.
