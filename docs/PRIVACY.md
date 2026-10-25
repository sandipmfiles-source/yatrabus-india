# YatriBus Privacy Architecture & Data Minimization

## Core Privacy Principles

1. **Zero Mandatory Account**: Passengers can discover transit routes, look up timetables, and contribute corrections without providing phone numbers, email addresses, or social accounts.
2. **Never Secretly Tracking**: No GPS coordinate is ever read or transmitted without an explicit in-app confirmation modal clearly explaining what data is collected and why.
3. **Bus-Level Aggregation**: Individual coordinates are evaluated server-side and transformed into an anonymous bus-level point. An individual passenger's path is never published or exposed.
4. **Safety Expiry Limit**: Journey sessions automatically expire after a maximum of 12 hours. Passengers can revoke location sharing at any second using the prominent Stop Sharing button.
5. **Anti-Abuse Protections**: IP addresses are transformed into one-way cryptographic hashes solely for rate-limiting spam requests and are never joined with transit search histories.
