# AGENTS.md — Rules for every AI agent working in this repo

This repo is a two-person project. Two humans, each with their own Antigravity agent, work in parallel.
Read these before doing anything:

1. docs/PROJECT_CONTEXT.md  — what we are building, hardware, hard constraints
2. docs/API_CONTRACT.md     — THE shared interface between frontend and firmware (source of truth)
3. docs/WORK_SPLIT.md       — who owns which files

## Non-negotiable rules
- Inspect existing files first. Explain your proposed changes/file structure BEFORE major edits. Never overwrite unrelated code.
- Only edit files your person owns (see WORK_SPLIT.md). If you need a change in the other person's area, write it in docs/CHANGE_REQUESTS.md instead of editing their files.
- docs/API_CONTRACT.md is the single source of truth for endpoints and JSON. If it must change: update the contract first, add a line to its Changelog, bump its version, and tell the human so they can notify their teammate. Never silently drift from it.
- Do NOT change hardware pins: GPS RX=GPIO16, GPS TX=GPIO17, Relay IN1=GPIO23, LDR=GPIO34. Do NOT change relay logic (HIGH = ON). Do NOT invent hardware.
- Never fabricate GPS, sunrise/sunset or LDR values and present them as real. Demo data must be clearly labelled DEMO.
- Never put Wi-Fi credentials or secrets in tracked files. Use secrets.h (gitignored) + secrets.example.h.
- Do not claim hardware integration works until it has been tested on a real ESP32. Say "untested on hardware" until then.
- Keep it lightweight: HTML/CSS/vanilla JS, no frameworks, no external CDNs, no external fonts.
- When the human says the project changed (new requirement, new pin, new field), update the relevant doc in docs/ as part of the same task.
