# Deep links

Source: hybrid `linking` config / expo-router file tree (cite file:line). Both route parsers have a table-driven
test that uses exactly the **Example** column.

**Custom scheme(s):** `<scheme>://`
**Universal links (iOS associated domains):** `applinks:<domain>` → `https://<domain>/.well-known/apple-app-site-association`
**App links (Android):** `https://<domain>` → `https://<domain>/.well-known/assetlinks.json` (SHA-256 of the signing key)

| Pattern | Route (iOS / Android) | Feature ID | Auth required | Example | Hybrid evidence |
|---|---|---|---|---|---|
| `/orders/:id` | `orderDetail(id)` | ORDERS-DETAIL | yes → login, then continue | `https://shop.acme.com/orders/42` | |
