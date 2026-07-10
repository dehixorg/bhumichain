module.exports = {
  apps: [
    {
      name: "record-scan",
      script: "python",
      args: "main.py",
      cwd: "./backend/ai-services/record-scan",
      watch: false,
    },
    {
      name: "ai-document-analyzer",
      script: "npm",
      args: "run server",
      cwd: "./backend/ai-document-analyzer",
      watch: false,
    }
  ]
};
