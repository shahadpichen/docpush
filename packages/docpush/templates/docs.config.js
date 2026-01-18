// DocPush Configuration
// Copy this to docs.config.js in your project root

module.exports = {
  github: {
    owner: "your-github-username",
    repo: "your-repo-name",
    branch: "main",
    docsPath: "docs",
  },

  // Auth Mode 1: Public - anyone can edit, admin password for approvals
  auth: {
    mode: "public",
    adminPassword: "change-me-in-production",
  },

  // Auth Mode 2: Domain-restricted - OAuth login with email domain check
  // auth: {
  //   mode: "domain-restricted",
  //   providers: ["google"], // or ["github"]
  //   allowedDomains: ["yourcompany.com"],
  // },

  admins: {
    emails: ["admin@example.com"],
  },

  branding: {
    name: "My Documentation",
  },
};
