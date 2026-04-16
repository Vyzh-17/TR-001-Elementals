const axios = require("axios");

async function parseInstruction(userInput) {
  const prompt = `
You are a drone mission planner.

Extract structured data from the user instruction.

Return ONLY valid JSON. No explanation.

Schema:
{
  "mission_type": "survey | inspect | delivery | unknown",
  "altitude": number or null,
  "area_focus": "string",
  "pattern": "zigzag | perimeter | point_to_point | unknown",
  "constraints": [string],
  "speed": number or null
}

Example:
Instruction: "Inspect tower at 50m"
Output:
{
  "mission_type": "inspect",
  "altitude": 50,
  "area_focus": "tower",
  "pattern": "point_to_point",
  "constraints": [],
  "speed": null
}

Instruction:
"${userInput}"
`;

  const response = await axios.post("http://localhost:11434/api/generate", {
    model: "llama3",
    prompt: prompt,
    stream: false
  });

  return response.data.response;
}

module.exports = parseInstruction;  