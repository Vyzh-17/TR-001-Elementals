const express = require("express");
const cors = require("cors");
const path = require("path");

const parseInstruction = require("./llm");
const extractJSON = require("./utils");
const generateWaypoints = require("./planner");

const app = express();

app.use(cors());
app.use(express.json());

/* ---------------- ROOT CHECK ---------------- */
app.get("/", (req, res) => {
  res.send("🚁 Drone NLP API is running");
});

/* ---------------- FRONTEND PAGE ---------------- */
app.get("/app", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ---------------- MAIN API ---------------- */
app.post("/parse", async (req, res) => {
  const { text } = req.body;

  try {
    console.log("INPUT:", text);

    const raw = await parseInstruction(text);
    console.log("RAW OUTPUT:", raw);

    const clean = extractJSON(raw);
    console.log("CLEAN JSON:", clean);

    if (!clean) {
      return res.status(400).json({ error: "Invalid JSON from model" });
    }

    const json = JSON.parse(clean);
    const waypoints = generateWaypoints(json);

    return res.json({
      mission: json,
      waypoints: waypoints
    });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: "Parsing failed" });
  }
});

/* ---------------- TEST ROUTE ---------------- */
app.get("/test", async (req, res) => {
  const text = "Survey the northern field at 30m altitude and avoid east side";

  try {
    console.log("TEST INPUT:", text);

    const raw = await parseInstruction(text);
    console.log("RAW OUTPUT:", raw);

    const clean = extractJSON(raw);
    console.log("CLEAN JSON:", clean);

    if (!clean) {
      return res.status(400).json({ error: "Invalid JSON from model" });
    }

    const json = JSON.parse(clean);
    const waypoints = generateWaypoints(json);

    return res.json({
      mission: json,
      waypoints: waypoints
    });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: "Test failed" });
  }
});

/* ---------------- SERVER ---------------- */
app.listen(5000, () => {
  console.log("🚀 Server running at http://localhost:5000");
});