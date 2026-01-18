# DocPush

Self-hosted, Git-backed collaborative documentation platform.

## Features

- 📝 **Git-backed** - All docs stored in your GitHub repo
- 🔐 **Flexible Auth** - Public, magic link, or OAuth
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

Only users with allowed email domains can edit.

```javascript
auth: {
  mode: 'domain-restricted',
  allowedDomains: ['company.com'],
  emailFrom: 'docs@company.com',
}
```

### OAuth Mode

GitHub/Google sign-in.

```javascript
auth: {
  mode: 'oauth',
  providers: ['github', 'google'],
}
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
} from "docpush/react";

function App() {
  return (
    <DocPushProvider config={{ apiUrl: "http://localhost:3000" }}>
      <DocsPage />
    </DocPushProvider>
  );
}
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
