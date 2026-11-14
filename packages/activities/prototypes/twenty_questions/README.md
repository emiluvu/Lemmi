# LEMMI 20 Questions — terminal prototype

Lukas's requested Python Version 1 experiment. This local terminal game follows
the hidden-subject / 20-question / assumed-No timeout brief. These rules differ
from the participant app's visible-picture, patient-paced activity. It is not
connected to Alex, shared sessions, policy storage, the robot, or the app catalog.
Integration requires the shared contracts and a review of those product differences.

Requires Python 3.10+; standard library only. From the repository root:

```powershell
python packages/activities/prototypes/twenty_questions/game.py
```

On this machine a portable Python runtime was downloaded from python.org into
the ignored `.tools` directory. Use:

```powershell
.\.tools\python-3.13.2\python.exe packages/activities/prototypes/twenty_questions/game.py
```

For a slower practice session (default is 10 seconds):

```powershell
.\.tools\python-3.13.2\python.exe packages/activities/prototypes/twenty_questions/game.py --timeout 60
```

Type `ready`, think of a subject, and answer `yes`/`y` or `no`/`n`.
Try a dog, apple, kettle, phone, bicycle, or beach first. The small deterministic
catalog cannot identify arbitrary subjects. Some entries have identical traits;
ties use catalog order. All 20 questions are asked even if one best match remains.
Questions are selected to split current best matches; no question repeats.
Contradictions retain the closest catalog matches rather than inventing facts.

An unanswered gameplay question is recorded in memory as assumed No. Three
consecutive timeouts end the session without a guess. A valid answer resets that
counter. Invalid answers retry the same question with a fresh response window.
Start, final confirmation, subject disclosure, and replay timeouts end the session.
Ctrl+C or closed input exits. Nothing is saved or sent to an external service.
Replay starts a new round immediately after Yes; no additional ready prompt.

Input uses console polling (`msvcrt` on Windows), `select` on POSIX, and
`PeekNamedPipe` for redirected Windows pipes. No blocking `input()` or background
input thread is used. Run in a real terminal, rather than an IDE output-only pane.
Windows redirected regular-file stdin is unsupported; use a console or pipe.

Run checks:

```powershell
.\.tools\python-3.13.2\python.exe -m unittest discover -s packages/activities/prototypes/twenty_questions -v
```

Automated checks cover game flow, answer normalization, invalid input, 20-question
limit, final guessing, assumed answers, timeout reset/exit, replay, and real pipe
input/deadlines on the current OS. Actual Windows console editing/typing requires
an interactive rehearsal; pipe tests do not establish that hardware-facing path.
