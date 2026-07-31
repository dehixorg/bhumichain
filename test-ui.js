const data = {
  errors: [
    { type: "field", value: "invalid", msg: "Invalid value", path: "officerHash", location: "body" }
  ]
};

let errorMsg = data.message || data.error;
if (data.errors && Array.isArray(data.errors)) {
  errorMsg = data.errors.map((e) => `${e.param}: ${e.msg}`).join(', ');
}
console.log("errorMsg =", errorMsg);
console.log("final =", errorMsg || 'Failed to initiate mutation');
