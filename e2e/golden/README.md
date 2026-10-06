# Golden reference

Recordings of the **hybrid** app that the native apps are compared against (guideline 10 § Golden reference).
Layout: `e2e/golden/<platform>/<flow>/` with the screenshots and the analytics `.jsonl` of that run.

Maestro's `takeScreenshot` writes into its own test-output folder (often `~/.maestro/tests/<run>/`). Copy the files here
after each run, or pass a test-output directory if your Maestro version supports it.

## Recordings

| Flow | Platform | Hybrid build (SHA / version) | Device / OS | Date | Recorded by |
|---|---|---|---|---|---|

## Waiting for access (`needs-account`)

Flows that are written but can't be recorded yet because they need an account, data or secrets. Each needs an owner and a date.
They must be recorded before any feature that uses them is `verified`.

| Flow | What's missing | Who provides it | By when |
|---|---|---|---|
