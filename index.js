import express from "express";
const app = express();
app.use(express.json());
const PORT = 3000;
app.get("/", (req, res) => {
  res.send("student-management-system");
});
app.listen(PORT, () => {
  console.log(`server live on http://localhost:${PORT}`);
});
