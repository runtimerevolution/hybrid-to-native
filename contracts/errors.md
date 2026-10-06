# Error codes

| Backend code / HTTP status | `AppError` case | User message (string key) | Retry? | Hybrid evidence |
|---|---|---|---|---|
| network failure / timeout | `network` | `common.error.network` | yes | |
| 401 | `unauthorized` | depends on the API: user session → refresh once, then log out; app-level key → show a generic error, don't log out | per API | |
| 2xx with a body that doesn't match the contract | `decoding` | `common.error.generic` | no | |
| 5xx | `server(code)` | `common.error.generic` | yes | |
