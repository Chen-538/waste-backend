// server.js — 雙模式＆穩定版
import express from "express";
import OpenAI from "openai";
import cors from "cors";

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(cors());

// Health check
app.get("/healthz", (req, res) => res.status(200).type("text/plain").send("ok"));
app.get("/", (req, res) => res.status(200).send("ok"));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===== 清單：垃圾分類（保留舊功能用）
const WASTE = [
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

// ===== 清單：蔬菜（台灣常見）
const VEG = [
  { name: "高麗菜", hints: ["cabbage","green cabbage","head cabbage","包心菜"] },
  { name: "大白菜", hints: ["napa cabbage","chinese cabbage","白菜","娃娃菜"] },
  { name: "青江菜", hints: ["bok choy","pak choi","baby bok choy"] },
  { name: "小白菜/油菜", hints: ["choy sum","yu choy","you cai"] },
  { name: "芥藍", hints: ["gai lan","chinese broccoli","kai lan"] },
  { name: "菠菜", hints: ["spinach"] },
  { name: "萵苣/生菜", hints: ["lettuce","leaf lettuce","butterhead"] },
  { name: "蘿蔓", hints: ["romaine lettuce","cos lettuce"] },
  { name: "芹菜", hints: ["celery"] },
  { name: "韭菜", hints: ["chive","garlic chive"] },
  { name: "香菜", hints: ["cilantro","coriander leaves"] },
  { name: "九層塔", hints: ["thai basil","basil (asian)"] },

  { name: "紅蘿蔔", hints: ["carrot"] },
  { name: "白蘿蔔", hints: ["daikon","radish","mooli"] },
  { name: "馬鈴薯", hints: ["potato"] },
  { name: "地瓜/蕃薯", hints: ["sweet potato"] },
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

  // 菇類（常視為蔬菜）
  { name: "洋菇", hints: ["button mushroom","white mushroom","cremini"] },
  { name: "香菇", hints: ["shiitake mushroom"] },
  { name: "杏鮑菇", hints: ["king oyster mushroom","eringii"] },
  { name: "金針菇", hints: ["enoki mushroom"] },
  { name: "鴻禧菇", hints: ["shimeji mushroom","beech mushroom"] },
  { name: "木耳", hints: ["wood ear","black fungus"] },

  // 保底
  { name: "非蔬菜／不確定", hints: ["not a vegetable","meat","fish","bread","snack","drink","package","plate","utensil","bottle","can","box"] },
];

const pickList = (mode) => (mode === "waste" ? WASTE : VEG);

// Debug：檢查目前的清單
app.get("/api/debug-categories", (req, res) => {
  const mode = (req.query.mode || "veg").toLowerCase();
  const list = pickList(mode);
  res.set("Cache-Control","no-store");
  res.json({ mode, names: list.map(x => x.name) });
});

async function classifyImage({ image, list, domain }) {
  const listText = list.map(c => `- ${c.name}: ${(c.hints || []).join(", ")}`).join("\n");
  const prompt = (domain === "veg")
    ? `You are a vegetable image classifier for Taiwan market.
Given a single photo, choose the ONE best-matching vegetable from the list below.
Rules:
- Output must use the EXACT Chinese name from the list (no new labels).
- If the image is not a vegetable or is too ambiguous, choose "非蔬菜／不確定" with a low score.
- Focus on raw produce (not cooked dishes); ignore plates/packaging/background.
- Calibrate scores in [0,1]. Higher = more confident.

Vegetable categories with hints:
${listText}`
    : `You are a waste-sorting classifier.
Choose the ONE best category from the list (Chinese names). Calibrate scores in [0,1].
Categories with hints:
${listText}`;

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
        name: "classification",
        schema: {
          type: "object",
          properties: {
            top: {
              type: "object",
              properties: {
                name: { type: "string" },
                score: { type: "number" }
              },
              required: ["name","score"],
              additionalProperties: false
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
  let data;
  try { data = JSON.parse(text); }
  catch { data = { top: { name: domain === "veg" ? "非蔬菜／不確定" : "不確定", score: 0 } }; }

  // 落地白名單
  const NAMES = new Set(list.map(x => x.name));
  if (!data?.top?.name || !NAMES.has(data.top.name)) {
    data.top = { name: domain === "veg" ? "非蔬菜／不確定" : "不確定", score: 0 };
  }
  return data;
}

// 路由：預設蔬菜
app.post("/api/classify", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "missing image dataURL" });
    const data = await classifyImage({ image, list: VEG, domain: "veg" });
    res.set("Cache-Control","no-store");
    res.json({ mode: "veg", ...data });
  } catch (err) {
    console.error("classify error:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post("/api/classify-veg", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "missing image dataURL" });
    const data = await classifyImage({ image, list: VEG, domain: "veg" });
    res.set("Cache-Control","no-store");
    res.json({ mode: "veg", ...data });
  } catch (err) {
    console.error("classify error:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post("/api/classify-waste", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "missing image dataURL" });
    const data = await classifyImage({ image, list: WASTE, domain: "waste" });
    res.set("Cache-Control","no-store");
    res.json({ mode: "waste", ...data });
  } catch (err) {
    console.error("classify error:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`API ready on :${PORT}`));
