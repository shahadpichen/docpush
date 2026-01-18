# DocPush

Self-hosted, Git-backed collaborative documentation platform.

## Features

- 📝 **Git-backed** - All docs stored in your GitHub repo
- 🔐 **Flexible Auth** - Public or OAuth with domain restriction
- ✏️ **Draft System** - Branch-based editing with approval workflow
- 💬 **Comments** - Collaborative review process
- ⚛️ **React Components** - Headless UI components for your app

## Quick Start

```bash
# Install
npm install @shahadpichen/docpush

# Initialize
npx @shahadpichen/docpush init

# Configure docs.config.js and .env

# Start
npx @shahadpichen/docpush start
```

## Configuration

Create `docs.config.js`:

```javascript
module.exports = {
  github: {
    owner: "your-username",
    repo: "your-repo",
    branch: "main",
    docsPath: "docs",
  },
  auth: {
    mode: "public",
    adminPassword: "your-admin-password",
  },
  admins: {
    emails: ["admin@example.com"],
  },
};
```

Create `.env`:

```
GITHUB_TOKEN=ghp_your_token
APP_URL=http://localhost:3000
SESSION_SECRET=your-secret
```

## Auth Modes

### Public Mode

Anyone can submit drafts, admin approves.

```javascript
auth: {
  mode: 'public',
  adminPassword: 'admin123',
}
```

### Domain-Restricted Mode

OAuth login (Google/GitHub) with email domain verification.

```javascript
auth: {
  mode: 'domain-restricted',
  providers: ['google'], // or ['github']
  allowedDomains: ['yourcompany.com'],
}
```

**Required env vars for domain-restricted:**

```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

## React Components

Import components for your own UI:

```tsx
import {
  DocPushProvider,
  DocsSidebar,
  MarkdownViewer,
  MarkdownEditor,
  useDocs,
  useDrafts,
} from "@shahadpichen/docpush/react";

function App() {
  return (
    <DocPushProvider config={{ apiUrl: "http://localhost:3000" }}>
      <DocsPage />
    </DocPushProvider>
  );
}
```

## Add Components (shadcn-style)

Copy components to your project for customization:

```bash
npx @shahadpichen/docpush add button input textarea
npx @shahadpichen/docpush add all
```

## API Endpoints

| Endpoint                       | Description        |
| ------------------------------ | ------------------ |
| `GET /api/docs/tree`           | Get docs file tree |
| `GET /api/docs/:path`          | Get doc content    |
| `GET /api/drafts`              | List drafts        |
| `POST /api/drafts`             | Create draft       |
| `POST /api/drafts/:id/approve` | Approve draft      |

## License

MIT
