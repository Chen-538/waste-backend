// server.js — Node/Express backend (Responses API, with decision/message)
import express from "express";
import OpenAI from "openai";
import cors from "cors";

const app = express();
app.use(express.json({ limit: "15mb" }));

// Allow CORS for GitHub Pages or other frontends.
// ⚠️ 建議部署時把 origin 換成你的 Pages 網址以提高安全性。
app.use(cors());

// Optional: serve static files if you deploy this backend alone
app.use(express.static("."));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CATEGORIES = [
  { name: "紙類", hints: ["paper","cardboard","newspaper","carton box","paper bag","copy paper"] },
  { name: "塑膠類", hints: ["plastic bottle","PET bottle","plastic container","plastic bag","plastic cup","food box"] },
  { name: "金屬類", hints: ["aluminum can","tin can","metal pan","metal lid"] },
  { name: "玻璃類", hints: ["glass bottle","glass jar","wine bottle","beverage bottle"] },
  { name: "保麗龍類", hints: ["polystyrene foam","styrofoam tray","foam packaging","EPS foam"] },
  { name: "電池類", hints: ["battery","lithium battery","AA battery","AAA battery"] },
  { name: "電子產品", hints: ["smartphone","laptop","electronics","circuit board","home appliance"] },
  { name: "燈管類", hints: ["fluorescent tube","CFL bulb","light bulb"] },
  { name: "廢油類", hints: ["waste oil","cooking oil","motor oil"] },
  { name: "光碟/磁帶", hints: ["CD","DVD","optical disc","cassette tape"] },
  { name: "生廚餘", hints: ["vegetable scraps","fruit peel","coffee grounds"] },
  { name: "熟廚餘", hints: ["leftover food","cooked food waste","soup"] },
  { name: "化學品容器", hints: ["pesticide bottle","chemical cleaner bottle","solvent container"] },
  { name: "醫療廢棄物", hints: ["syringe","medicine","pill blister pack","cotton swab"] },
  { name: "含汞製品", hints: ["mercury thermometer","mercury sphygmomanometer"] },
  { name: "家具家電", hints: ["sofa","refrigerator","television","bed frame","washing machine"] },
  { name: "建築廢料", hints: ["concrete","brick","tile","lumber"] },
];

const CONF_STRONG = 0.75; // 75%
const CONF_WEAK   = 0.45; // 45%

app.post("/api/classify", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "missing image dataURL" });

    const listText = CATEGORIES.map(c => `- ${c.name}: ${(c.hints||[]).join(", ")}`).join("\n");
    const prompt = "You are a waste-sorting classifier. Given an image, choose the single best category from the list. Calibrate scores in [0,1], roughly summing to 1. Return JSON.";

    const r = await client.responses.create({
      model: "gpt-4o-mini",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `${prompt}\nCategories with hints:\n${listText}` },
          { type: "input_image", image_url: image }
        ]
      }],
      text: {
        format: {
          type: "json_schema",
          name: "waste_classification",
          schema: {
            type: "object",
            properties: {
              top: {
                type: "object",
                properties: { name: { type: "string" }, score: { type: "number" } },
                required: ["name", "score"],
                additionalProperties: false
              },
              scores: {
                type: "array",
                items: {
                  type: "object",
                  properties: { name: { type: "string" }, score: { type: "number" } },
                  required: ["name", "score"],
                  additionalProperties: false
                }
              }
            },
            required: ["top", "scores"],
            additionalProperties: false
          },
          strict: true
        }
      }
    });

    const text = r.output_text || r.output?.[0]?.content?.[0]?.text || r.text || "";
    const parsed = JSON.parse(text);

    let top = parsed?.top;
    if (!top && Array.isArray(parsed?.scores) && parsed.scores.length) {
      top = parsed.scores.slice().sort((a,b)=>b.score-a.score)[0];
    }
    top = top || { name: "未知", score: 0 };
    const scores = parsed?.scores || [];

    const pct = Math.round((top.score || 0) * 100);
    let message = "";
    let decision = "uncertain";
    if (top.score >= CONF_STRONG) {
      message = `就是（${top.name}）`;
      decision = "certain";
    } else if (top.score >= CONF_WEAK) {
      message = `較可能（${pct}%）是（${top.name}）`;
      decision = "likely";
    } else {
      message = `不確定（最高 ${pct}%）`;
      decision = "uncertain";
    }

    res.json({ top, scores, message, decision, threshold: { strong: CONF_STRONG, weak: CONF_WEAK } });
  } catch (err) {
    console.error("classify error:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}`));
