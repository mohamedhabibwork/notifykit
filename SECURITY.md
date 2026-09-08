# Security policy

## Reporting a vulnerability

Do not report security vulnerabilities through public GitHub issues. Use GitHub's private security advisory flow for this repository, or contact the maintainer privately through the repository owner's GitHub profile.

Include a clear description, affected version, reproduction steps, impact, and any proposed mitigation. Please allow reasonable time for acknowledgement and remediation before public disclosure.

## Security expectations

NotifyKit must not log, serialize, or include credentials in normalized errors. Provider tokens, passwords, private keys, authorization headers, and bot tokens belong in environment variables or a secrets manager—not source control.
