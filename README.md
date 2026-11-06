 
# HOOKE
### The Abingdon Library Management Platform

<p align="center">
  <strong>A modern, intelligent and beautifully structured library management experience.</strong>
  <br />
  Designed for Abingdon School.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/STATUS-IN%20DEVELOPMENT-orange?style=for-the-badge" alt="Status: In Development" />
  <img src="https://img.shields.io/badge/BUILT%20WITH-TypeScript-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PLATFORM-WEB-black?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Web Platform" />
  <img src="https://img.shields.io/badge/LICENSE-Proprietary-lightgrey?style=for-the-badge" 
    [![Netlify Status](https://api.netlify.com/api/v1/badges/26825ba9-96cb-4684-b338-344c9b4d942e/deploy-status)](https://app.netlify.com/projects/hookeabi/deploys)
  alt="License" />
</p>

---

## Overview

**Hooke** is a modern web-based library management platform developed with the aim of bringing a more intuitive, accessible and streamlined digital experience to the Abingdon School library.

Combining a carefully designed frontend with a dedicated backend architecture, Hooke is being developed as a centralised platform for managing library resources, user accounts and administrative operations.

The project places particular emphasis on:

- **Design:** A clean, contemporary interface with attention to detail.
- **Functionality:** Practical tools designed around real library workflows.
- **Architecture:** A modular frontend and backend structure.
- **Scalability:** A foundation designed to support future functionality.
- **Accessibility:** An interface that prioritises clarity and usability.

Hooke is not simply a static website. It is an evolving software project with a dedicated API, database architecture and frontend application.

---

## Contents

- [Project Vision](#-project-vision)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Configuration](#-environment-configuration)
- [Development](#-development)
- [API](#-api)
- [Security](#-security)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Project Information](#-project-information)
- [Contact](#-contact)

---

## Project Vision

The objective behind Hooke is to create a library platform that feels as considered as modern commercial software while remaining practical for an educational environment.

Rather than building everything into a single application file, the project follows a structured development approach.

The platform is divided into two principal components:

| Component | Responsibility |
|---|---|
| Frontend | User interface, interactions and application experience |
| Backend | API, business logic, database operations and server functionality |

This separation allows both components to evolve independently while maintaining a consistent application architecture.

---

## Features

### User Experience

- Modern, responsive web interface.
- Custom-designed interface components.
- Liquid-glass inspired button styling.
- Structured application navigation.
- Dedicated user-facing and administrative experiences.

### Administration

- Administrative account functionality.
- Foundation for library management operations.
- Structured backend architecture.
- Database-backed application design.

### Technical Features

- Express.js REST API.
- TypeScript backend.
- Prisma ORM integration.
- PostgreSQL database support.
- Modular application structure.
- Environment-based configuration.
- Dedicated frontend and backend directories.

> **Development note:** Some features remain under development. The frontend currently retains demonstration/localStorage logic and has not yet been fully connected to the production API.

---

## Technology Stack

Hooke uses a modern web development stack selected for maintainability, flexibility and extensibility.

### Frontend

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | Styling and responsive design |
| JavaScript | Client-side functionality |
| Custom CSS components | Reusable interface elements |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | HTTP server and API framework |
| TypeScript | Type-safe application development |
| Prisma | Database ORM |
| PostgreSQL | Relational database |

### Development & Infrastructure

| Technology | Purpose |
|---|---|
| Git | Version control |
| GitHub | Source code management |
| GitHub Codespaces | Cloud development environment |
| GitHub Pages & Netlify| Frontend hosting (where configured) |
| npm | Package management |

---

## Architecture

Hooke follows a separated frontend/backend architecture.

```mermaid
flowchart TD
    A["User"] --> B["Hooke Frontend"]
    B --> C["Application Interface"]
    C --> D["REST API"]
    D --> E["Express.js Server"]
    E --> F["Business Logic"]
    F --> G["Prisma ORM"]
    G --> H[("PostgreSQL Database")]

    style A fill:#64748b,color:#fff
    style B fill:#2563eb,color:#fff
    style E fill:#16a34a,color:#fff
    style H fill:#7c3aed,color:#fff
```

### Application Flow

1. Users interact with the frontend.
2. The frontend communicates with the backend through HTTP requests.
3. Express handles incoming API requests.
4. Application logic processes the requested operation.
5. Prisma manages database interactions.
6. PostgreSQL stores and retrieves persistent application data.

This structure provides a clear separation between presentation, application logic and data persistence.

---

## Project Structure

The repository is organised to keep the application maintainable as development progresses.

```text
Hooke/
│
├── backend/
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   │
│   ├── src/
│   │   ├── db/
│   │   │   └── prisma.ts
│   │   │
│   │   ├── app.ts
│   │   └── index.ts
│   │
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
├── frontend/
│   │
│   ├── index.html
│   │
│   ├── css/
│   │   └── styles.css
│   │
│   ├── js/
│   │   └── app.js
│   │
│   └── ...
│
└── README.md
```

### Directory Responsibilities

**`backend/`**

Contains the server-side application, Prisma configuration, database schema and API implementation.

**`frontend/`**

Contains the browser-facing application, including its HTML structure, stylesheets and JavaScript functionality.

**`prisma/`**

Contains the database schema and seed configuration.

**`src/db/`**

Contains the Prisma database client configuration.

---

## Getting Started

Follow these instructions to set up the project locally.

### Prerequisites

Ensure the following are installed:

- Node.js
- npm
- Git
- PostgreSQL

### 1. Clone the Repository

```bash
git clone https://github.com/sebusherrr/Hooke.git
```

Navigate into the project:

```bash
cd Hooke
```

### 2. Set Up the Backend

```bash
cd backend
npm install
```

### 3. Configure Environment Variables

Create a local environment file:

```bash
cp .env.example .env
```

Open `.env` and configure the required database connection.

### 4. Configure Prisma

Once PostgreSQL is running and the environment variables are configured:

```bash
npx prisma generate
```

Apply the database schema:

```bash
npx prisma migrate dev
```

### 5. Start Development

Run the backend using the development script defined in `backend/package.json`.

```bash
npm run dev
```

> The exact available npm scripts are defined in the backend package configuration.

### 6. Launch the Frontend

Open `frontend/index.html` in a browser or use a local development server.

The frontend and backend are currently separate development components.

---

## Environment Configuration

The backend uses environment variables to keep configuration separate from source code.

Example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/hooke"
PORT=3000
```

Your actual `.env.example` file is the reference for the required configuration.

**Important:** Never commit your actual `.env` file, database credentials, private keys or production secrets to GitHub.

---

## API

The backend is structured around a REST API powered by Express.js.

The API is intended to provide a central interface for communication between the frontend and persistent database.

### API Design Principles

- Consistent request and response structures.
- Separation of routing and application logic.
- TypeScript-based development.
- Database access through Prisma.
- Centralised server configuration.

### Current Development Status

The backend has an initial Express/TypeScript/Prisma foundation.

Frontend-to-backend integration remains an active development task.

API endpoints should be documented here as they are implemented.

---

## Security

Security is an important consideration in the development of Hooke.

The project follows these principles:

- Environment variables for sensitive configuration.
- No committed production credentials.
- Server-side handling of privileged operations.
- Separation between frontend and backend responsibilities.
- Database access managed through Prisma.

Authentication, authorisation and production security controls must be fully implemented and verified before deployment for real users.

---

## Roadmap

Hooke is an evolving project. The following roadmap outlines its intended development direction.

### Foundation

- [x] Establish repository structure.
- [x] Create separate frontend and backend projects.
- [x] Implement initial Express backend.
- [x] Introduce TypeScript.
- [x] Configure Prisma.
- [x] Create frontend stylesheet architecture.
- [x] Develop initial user interface.

### Backend Development

- [ ] Complete API implementation.
- [ ] Establish database migrations.
- [ ] Implement authentication.
- [ ] Introduce role-based permissions.
- [ ] Implement persistent application data.
- [ ] Add API validation and error handling.
- [ ] Implement automated backend testing.

### Frontend Integration

- [ ] Connect frontend to backend API.
- [ ] Replace demonstration/localStorage logic.
- [ ] Implement persistent user sessions.
- [ ] Integrate administrative functionality.
- [ ] Improve loading and error states.
- [ ] Refine responsive behaviour.

### Deployment & Quality

- [ ] Configure production environment.
- [ ] Establish deployment workflow.
- [ ] Introduce automated testing.
- [ ] Improve documentation.
- [ ] Conduct security review.
- [ ] Prepare production release.

---

## Contributing

Hooke is maintained as a structured software development project.

Contributions should prioritise:

- Readable and maintainable code.
- Consistent naming conventions.
- Clear separation of responsibilities.
- Meaningful commit messages.
- Appropriate testing.
- Documentation of significant changes.

### Development Guidelines

1. Keep frontend and backend responsibilities separate.
2. Avoid introducing unnecessary dependencies.
3. Keep credentials and environment files out of version control.
4. Test changes before submitting them.
5. Document new functionality appropriately.

---

## Project Information

| Property | Details |
|---|---|
| Project | Hooke |
| Organisation | Abingdon School |
| Type | Web application |
| Repository | Hooke |
| Architecture | Frontend + Backend |
| Backend | Express / TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Status | Active Development |

---

## Documentation

Detailed project documentation is available in the `docs/` directory:

- [Architecture](docs/architecture.md) — application layers and system design.
- [API Reference](docs/api.md) — API principles and resource areas.
- [Database](docs/database.md) — Prisma models and data relationships.
- [Development Guide](docs/development.md) — local setup and development workflow.
- [Deployment](docs/deployment.md) — production deployment guidance and checklist.
- [Contributing](CONTRIBUTING.md) — contribution and pull-request standards.
- [Security Policy](SECURITY.md) — vulnerability reporting and security principles.
- [Changelog](CHANGELOG.md) — project history and planned release tracking.

---

## Contact

For questions, feedback, suggestions or enquiries about Hooke, contact the project developer:

**[seb.usher@abingdon.org.uk](mailto:seb.usher@abingdon.org.uk)**

See the full [Contact](CONTACT.md) page for more information. For security vulnerabilities, please follow the [Security Policy](SECURITY.md) rather than opening a public issue.

---

## Acknowledgements

Developed for Abingdon School as an independent software development project.

Built with an emphasis on modern web technologies, thoughtful interface design and a maintainable application architecture.

---

<p align="center">
  <strong>HOOKE</strong>
  <br />
  <sub>A more considered approach to library management.</sub>
  <br /><br />
  <sub>Designed with purpose. Built for the future.</sub>
</p>
