import { Router } from "express";
//import { pool } from "../db.js"
import { insertTriage, getTriageById, getRecentTriages } from "../db.js"
const router = Router();

/**
 * POST /triage
 *
 * TODO (candidate):
 * - Validate input
 *   - reject empty text
 *   - reject text > 4000 chars
 * - Design prompt and call LLM
 * - Parse and validate LLM response
 * - Apply confidence guardrail (< 0.6)
 * - Store input and result in PostgreSQL
 * - Return structured JSON response
 */

/** was going to use it with OpenAI 
const Triage_schema = {
  name: "triage_result",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "category", "priority", "summary", "suggested_response", "confidence"],
    properties: {
      title: { type: "string"},
      category: { type: "string", enum: ["billing", "technical", "account", "other" ]},
      priority: {type: "string", enum: ["low", "medium", "high"]},
      summary: {type: "string"},
      suggested_response: {type: "string"},
      confidence: {type: "number", minimum:0, maximum:1}
    }
  }
};
**/
function extractFirstJSONObject(s) {
  // grab from first { to last }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in LLM output");
  }
  return s.slice(start, end + 1);
}

async function triageLLM(text) {
   
  // prompt design
  const prompt = `
  you are a customer support triage assistant.
  Analyze customer message
  Return ONLY a single JSON Object. No other text. 
  with the following fields:
- title
- category (billing | technical | account | other)
- priority (low | medium | high)
- summary
- suggested_response
- confidence (number between 0 and 1)

  Do not include markdown or extra text.

  Rules:
  Title: max 80 characters. Create clear title summarizing the main issue. Be specific.
  Category:
     - "billing": Payment issues, refunds, charges, invoices, pricing questions, subscription problems
     - "technical": Bugs, errors, app crashes, performance issues, integration problems, feature not working
     - "account": Login issues, password resets, profile updates, account access, settings changes
     - "other": Feature requests, general questions, feedback, compliments, unclear issues
  Confidence: lower if ambiguous or missing details.

  Support message: 
  """${text}"""
  `;

   

    const response = await fetch("http://localhost:11434/api/generate",{
      method: "POST",
      headers: { "Content-Type": "application/json"},
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "llama3.1",
        prompt,
        stream: false
      }),
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.status} ${await response.text()}`);

    const data = await response.json();
    const raw = data.response;

    const jsonText = extractFirstJSONObject(raw);
    return JSON.parse(jsonText);


  
}
function validateInput(text) {
  if (typeof text !== "string") return "input must be text string";
  const trimmed = text.trim();
  if (!trimmed) return "Please enter text. Field cannot be empty";
  if (trimmed.length > 4000) return "Input exceeded valid length (max 4000 chars)";
  return null;
}

router.post("/", async (req, res) => {
 try {
  const { text } = req.body;

  const error = validateInput(text);
  if (error) {
    return res.status(400).json({ error });
  }

  const resultJson = await triageLLM(text);

  // Guardrail: if confidence < 0.6 keep output but flag for review 
  if ( resultJson.confidence < 0.6) {
    resultJson.suggested_response = 
    " Needs human review " + resultJson.suggested_response;
  }

  const saved = await insertTriage({
    text, resultJson, model : "mock", latency : 0
  });

  return res.json({
    id : saved.id,
    ...resultJson,
  });


 } catch (err) {
  console.error(err);
  return res.status(500).json({error: "internal server error"});
 }
});

/**
 * GET /triage/:id
 *
 * TODO (candidate):
 * - Fetch a single triage record by id from PostgreSQL
 * - Return stored result
 * - Handle not found case
 */
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)){
      return res.status(400).json({error: "Invalid id"})
    }


    const item = await getTriageById(id);
    if (!item) return res.status(404).json({error: "Not found"});

    return res.json(item);

   
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal server error"})
  

  }

});

/**
 * GET /triage?limit=10
 *
 * TODO (candidate):
 * - Read limit from query params
 * - Default to 10
 * - Fetch most recent records ordered by created_at DESC
 * - Return list
 */
router.get("/", async (req, res) => {

  try {
    let limit = Number(req.query.limit || 10);

    // validation 
    if (!Number.isInteger(limit) || limit <= 0){
      limit = 10
    }
    if (limit > 50){
      limit = 50; // setting limits for huge queries 
    }

    

    console.log("limit =", limit);
    const items = await getRecentTriages(limit);
    console.log("items type =", typeof items, "isArray =", Array.isArray(items));
    return res.json(items);

  } catch(err) {
    console.error(err);
    return res.status(500).json({ error: "internal server error"})
  }
  
});

export default router;
