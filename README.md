# Yes, No or Not Given

Decide whether statements match the writer's views or claims, a question type about opinions rather than facts.

Part of the [IELTS Study Suite](https://github.com/Apurba94/ielts-study-suite): 100 free study apps for IELTS. This one is for the IELTS Academic and General Training test. It works offline, as a Windows program or in the browser.

## Download and run

- **Windows:** download `Yes, No or Not Given.exe` from the [latest release](https://github.com/Apurba94/ielts-ynng/releases/latest) and open it. Nothing to install. It opens in its own window and saves your progress in your user folder.
- **Browser:** open it online in the suite's web edition at https://ielts-study-suite.vercel.app/apps/ielts-ynng/ . Progress stays in that browser.
- **From source:** `python launcher.py` (Python 3.10 or later, no packages needed).

## What it does

Yes, No or Not Given asks about the writer's opinions and claims, not facts. You need to separate what the writer believes from the views they report and then reject. Practise with 32 short opinion texts, each with an explanation.

Sections: Practice, Opinion signals, Progress, About.

## How to use it

1. Find the writer's own view: watch for "critics claim" or "is often said", which introduce other people's views.
2. Choose Yes if the statement matches the writer's view, No if it contradicts it, Not Given if the writer does not say.
3. Learn the words that show opinion in **Opinion signals**.

## Good to know

- All questions, passages, recordings and definitions were written for this suite. None are official IELTS questions. For official practice, use the materials on ielts.org and from the test partners.
- It follows IELTS as delivered on computer in 2026. Formats change, so check ielts.org before your test.
- Listening uses the voices installed on your computer, which sound less natural than real test recordings.
- Feedback on writing and speaking counts what a program can count honestly, such as length and linking words. It is not an IELTS band score. Band conversions for Listening and Reading are approximate.
- Not endorsed by or affiliated with the British Council, IDP or Cambridge University Press & Assessment. IELTS is a registered trademark of its owners.

## For developers

The app is plain HTML and JavaScript in `web/`, run by a small Python launcher that serves it on 127.0.0.1 only and needs a secret token for saving. Tests: `node --test "tests/*.test.js"` (29 tests) and `python -m unittest discover -s tests`. Build the .exe with `python build_exe.py`.

Built with AI assistance (Claude Code). MIT licence. By JANIN A APURBA.
