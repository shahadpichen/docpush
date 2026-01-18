// DocPush Configuration
// Copy this to docs.config.js in your project root

module.exports = {
  github: {
    owner: "your-github-username",
    repo: "your-repo-name",
    branch: "main",
    docsPath: "docs",
  },
  auth: {
    mode: "public",
    adminPassword: "change-me-in-production",
  },
  admins: {
    emails: ["admin@example.com"],
  },
  branding: {
    name: "My Documentation",
  },
};
