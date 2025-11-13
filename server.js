import express from "express";

const app = express();
const PORT = 8000;

app.get("/test", (req, res) => {
  res.send("Hello World");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
