# Recovery Companion: project handbook

This handbook explains the whole project: what it does, how it is built, and why.
Every page is based on the code in this repository, with file paths you can open.

New to the project? Read the pages in this order:

| # | Page | What you will learn |
|---|---|---|
| 1 | [Project overview](PROJECT_OVERVIEW.md) | The problem, the goals and who the app is for |
| 2 | [Features](FEATURES.md) | Every feature, how it works, and its status |
| 3 | [System architecture](SYSTEM_ARCHITECTURE.md) | How the phone app, server, coach and model fit together |
| 4 | [Tech stack](TECH_STACK.md) | Each technology and why it was chosen |
| 5 | [Safety and privacy](SAFETY_AND_PRIVACY.md) | Consent, data handling, security and safety controls |
| 6 | [AI and ML](AI_AND_ML.md) | The AI coach, the risk model, training and evaluation, and their limits |
| 7 | [Backend guide](BACKEND_GUIDE.md) | How the support-circle API works inside |
| 8 | [API reference](API_REFERENCE.md) | Every endpoint, with examples and error codes |
| 9 | [Database guide](DATABASE_GUIDE.md) | The phone database and the server database |
| 10 | [Setup and installation](SETUP_AND_INSTALLATION.md) | Run it on a laptop, in a browser and on Android |
| 11 | [Testing and CI/CD](TESTING_AND_CI_CD.md) | Tests, quality gates and GitHub Actions |
| 12 | [Deployment guide](DEPLOYMENT_GUIDE.md) | Docker, HTTPS, Kubernetes and OpenChoreo |
| 13 | [Developer guide](DEVELOPER_GUIDE.md) | Find your way around the code and extend it |
| 14 | [Project roadmap](PROJECT_ROADMAP.md) | What is done, what is left, what comes next |
| 15 | [Glossary](GLOSSARY.md) | Technical words in plain English |

## Status labels used in this handbook

| Label | Meaning |
|---|---|
| **Implemented** | Built, tested and working in this repository |
| **Partial** | Built, but something is missing or needs setup (explained where it appears) |
| **Planned** | Not built yet. Listed in the [roadmap](PROJECT_ROADMAP.md) |

## The design documents

The handbook explains the project. The original design documents in `docs/` remain
the detailed reference:

- [architecture.md](../architecture.md): design decisions (D1–D13) and diagrams
- [privacy.md](../privacy.md): full data inventory and threat model
- [plan.md](../plan.md): the 11 milestones with acceptance criteria and results
- [deploy.md](../deploy.md): deployment commands and CI/CD details
