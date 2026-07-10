module.exports = {
  apps: [
    {
      name: "api-gateway",
      script: "npm.cmd",
      args: "run start",
      cwd: "./backend/api-gateway",
      watch: false,
    },
    {
      name: "frontend",
      script: "npm.cmd",
      args: "run dev",
      cwd: "./frontend/web-portal",
      watch: false,
    }
  ]
};
