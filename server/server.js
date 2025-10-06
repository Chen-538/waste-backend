// server.js — 後端直連 OpenAI（金鑰只在伺服器）
import express from "express";
import OpenAI from "openai";
import cors from "cors";

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(cors());

// ✅ Health check（Render 設定 Health Check Path = /healthz）
app.get("/healthz", (req, res) => res.status(200).type("text/plain").send("ok"));
// 也讓根路徑回 200（萬一 Health Check 設成 "/" 也能過）
app.get("/", (req, res) => res.status(200).send("ok"));

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

// API：前端只傳 { image: dataURL }
app.post("/api/classify", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "missing image dataURL" });

    const listText = CATEGORIES.map(c =>
      `- ${c.name}: ${(c.hints || []).join(", ")}`
    ).join("\n");

    const prompt =
      "You are a waste-sorting classifier. " +
      "Given an image, choose the single best category from the list. " +
      "Calibrate scores in [0,1], roughly summing to 1. Return JSON.";

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
    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    console.error("classify error:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// （可選）若這個服務不是用來直接跑前端頁面，這行建議移除：
// app.use(express.static("."));

const PORT = process.env.PORT || 3000;
// ✅ 明確綁 0.0.0.0
app.listen(PORT, "0.0.0.0", () => console.log(`API ready on :${PORT}`));
