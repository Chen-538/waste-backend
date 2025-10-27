// server.js — 蔬菜辨識器（後端直連 OpenAI；金鑰只在伺服器）
import express from "express";
import OpenAI from "openai";
import cors from "cors";

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(cors());

// ✅ Health check
app.get("/healthz", (req, res) => res.status(200).type("text/plain").send("ok"));
app.get("/", (req, res) => res.status(200).send("ok"));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 常見蔬菜（台灣常見＋中英別名/同義字）
const VEGETABLES = [
  { name: "高麗菜", hints: ["cabbage","green cabbage","head cabbage","包心菜"] },
  { name: "大白菜", hints: ["napa cabbage","chinese cabbage","白菜","娃娃菜"] },
  { name: "青江菜", hints: ["bok choy","pak choi","baby bok choy","小松菜?"] },
  { name: "小白菜/油菜", hints: ["choy sum","yu choy","you cai"] },
  { name: "芥藍", hints: ["gai lan","chinese broccoli","kai lan"] },
  { name: "菠菜", hints: ["spinach"] },
  { name: "萵苣/生菜", hints: ["lettuce","leaf lettuce","butterhead"] },
  { name: "蘿蔓", hints: ["romaine lettuce","cos lettuce"] },
  { name: "芹菜", hints: ["celery"] },
  { name: "韭菜", hints: ["chive","garlic chive","leek (asian)"] },
  { name: "香菜", hints: ["cilantro","coriander leaves"] },
  { name: "九層塔", hints: ["thai basil","basil (asian)"] },

  { name: "紅蘿蔔", hints: ["carrot"] },
  { name: "白蘿蔔", hints: ["daikon","radish","mooli"] },
  { name: "馬鈴薯", hints: ["potato"] },
  { name: "地瓜/蕃薯", hints: ["sweet potato","yam (misused)"] },
  { name: "洋蔥", hints: ["onion","brown onion","red onion"] },
  { name: "青蔥", hints: ["scallion","spring onion","green onion"] },
  { name: "蒜頭", hints: ["garlic","garlic bulb"] },
  { name: "薑", hints: ["ginger","ginger root"] },

  { name: "番茄", hints: ["tomato","roma","cherry tomato"] },
  { name: "茄子", hints: ["eggplant","aubergine","brinjal"] },
  { name: "小黃瓜/胡瓜", hints: ["cucumber","japanese cucumber"] },
  { name: "櫛瓜", hints: ["zucchini","courgette"] },
  { name: "青椒/甜椒/彩椒", hints: ["bell pepper","capsicum","green pepper","red pepper","yellow pepper"] },
  { name: "辣椒", hints: ["chili","chilli","hot pepper"] },

  { name: "花椰菜（白）", hints: ["cauliflower"] },
  { name: "綠花椰（西蘭花）", hints: ["broccoli"] },
  { name: "玉米", hints: ["corn","maize","sweet corn","corn cob"] },
  { name: "蘆筍", hints: ["asparagus"] },

  { name: "冬瓜", hints: ["winter melon","ash gourd"] },
  { name: "絲瓜", hints: ["luffa","loofah","sponge gourd"] },
  { name: "苦瓜", hints: ["bitter melon","bitter gourd","karela"] },
  { name: "南瓜", hints: ["pumpkin","kabocha","squash"] },
  { name: "櫛瓜南瓜（北海道南瓜）", hints: ["kabocha squash","japanese pumpkin"] },

  { name: "四季豆", hints: ["green bean","string bean","french bean"] },
  { name: "豌豆/荷蘭豆", hints: ["pea","snow pea","sugar snap"] },
  { name: "竹筍", hints: ["bamboo shoot"] },

  // 菇類常被當作蔬菜處理（若你不想收菇，可刪除下列幾項）
  { name: "洋菇", hints: ["button mushroom","white mushroom","cremini"] },
  { name: "香菇", hints: ["shiitake mushroom"] },
  { name: "杏鮑菇", hints: ["king oyster mushroom","eringii"] },
  { name: "金針菇", hints: ["enoki mushroom"] },
  { name: "鴻禧菇", hints: ["shimeji mushroom","beech mushroom"] },
  { name: "木耳", hints: ["wood ear","black fungus"] },

  // 保底類別
  { name: "非蔬菜／不確定", hints: ["not a vegetable","meat","fish","bread","snack","drink","package","plate","utensil","bottle","can","box"] },
];

app.post("/api/classify", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "missing image dataURL" });

    const listText = VEGETABLES.map(c =>
      `- ${c.name}: ${(c.hints || []).join(", ")}`
    ).join("\n");

    const prompt =
`You are a vegetable image classifier for Taiwan market.
Given a single photo, choose the ONE best-matching vegetable from the list below.
Rules:
- Output must use the EXACT Chinese name from the list (no new labels).
- If the image is not a vegetable or is too ambiguous, choose "非蔬菜／不確定" with a low score.
- Focus on raw produce (not cooked dishes); ignore plates/packaging/background.
- Calibrate scores in [0,1]. Higher = more confident.

Vegetable categories with hints:
${listText}
`;

    const r = await client.responses.create({
      model: "gpt-4o-mini",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: image }
        ]
      }],
      text: {
        format: {
          type: "json_schema",
          name: "vegetable_classification",
          schema: {
            type: "object",
            properties: {
              top: {
                type: "object",
                properties: {
                  name: { type: "string" },  // must be one of the list (by instruction)
                  score: { type: "number" }
                },
                required: ["name", "score"],
                additionalProperties: false
              },
              // 可選：回傳前幾名（別太多以免變大）
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
            required: ["top"],
            additionalProperties: false
          },
          strict: true
        }
      }
    });

    const text = r.output_text || r.output?.[0]?.content?.[0]?.text || r.text || "";
    let data = {};
    try {
      data = JSON.parse(text);
    } catch (e) {
      // 若模型沒照 schema，包成保底
      data = { top: { name: "非蔬菜／不確定", score: 0.0 } };
    }

    // 防呆：若名字不在清單，轉為不確定
    const NAMES = new Set(VEGETABLES.map(v => v.name));
    if (!data?.top?.name || !NAMES.has(data.top.name)) {
      data.top = { name: "非蔬菜／不確定", score: 0.0 };
    }

    res.json(data);
  } catch (err) {
    console.error("classify error:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`API ready on :${PORT}`));
