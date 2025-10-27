// server.js — 雙模式＆擴充版（含：清單外 → 其他蔬菜／待擴充 + raw_guess）
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
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // 需要更聰明可改成 "gpt-4o" 或 "o4-mini"

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

// ===== 清單：蔬菜（200 標籤，盡量常見；+2 保底） =====
const VEG = [
  // 01–20｜葉菜類（萵苣/甘藍/芥菜族）
  { name: "高麗菜", hints: ["cabbage","head cabbage","包心菜"] },
  { name: "大白菜", hints: ["napa cabbage","chinese cabbage","娃娃菜"] },
  { name: "青江菜", hints: ["bok choy","pak choi","baby bok choy"] },
  { name: "小白菜/油菜", hints: ["choy sum","yu choy","you cai"] },
  { name: "芥藍", hints: ["gai lan","chinese broccoli","kai lan"] },
  { name: "芥菜", hints: ["mustard greens"] },
  { name: "雪裡紅", hints: ["snow vegetable","pickling mustard"] },
  { name: "塌棵菜", hints: ["tatsoi"] },
  { name: "油麥菜/A菜", hints: ["taiwan lettuce","youmai"] },
  { name: "結球萵苣/美生菜", hints: ["iceberg lettuce"] },
  { name: "奶油萵苣", hints: ["butterhead lettuce","bibb"] },
  { name: "紫萵苣", hints: ["red leaf lettuce"] },
  { name: "蘿蔓", hints: ["romaine lettuce","cos"] },
  { name: "苦苣", hints: ["endive"] },
  { name: "菊苣", hints: ["radicchio","chicory"] },
  { name: "芝麻葉", hints: ["arugula","rocket"] },
  { name: "水菜", hints: ["mizuna"] },
  { name: "茼蒿", hints: ["crown daisy","tong ho"] },
  { name: "紫甘藍", hints: ["red cabbage"] },
  { name: "抱子甘藍", hints: ["brussels sprouts"] },

  // 21–40｜其他葉菜＆苗
  { name: "菠菜", hints: ["spinach"] },
  { name: "紅鳳菜", hints: ["gynura bicolor"] },
  { name: "皇宮菜/胭脂菜", hints: ["amaranth greens"] },
  { name: "空心菜/蕹菜", hints: ["water spinach","ong choy"] },
  { name: "地瓜葉", hints: ["sweet potato leaves"] },
  { name: "甜菜葉", hints: ["swiss chard","chard"] },
  { name: "羽衣甘藍", hints: ["kale"] },
  { name: "黑葉羽衣甘藍", hints: ["lacinato kale","dinosaur kale"] },
  { name: "羅馬花椰菜", hints: ["romanesco"] },
  { name: "芥菜頭/大頭菜", hints: ["kohlrabi"] },
  { name: "萵筍/莴笋", hints: ["celtuce","stem lettuce"] },
  { name: "豆苗/豌豆苗", hints: ["pea shoots"] },
  { name: "苜蓿芽", hints: ["alfalfa sprouts"] },
  { name: "向日葵芽", hints: ["sunflower sprouts"] },
  { name: "蘿蔔苗", hints: ["radish sprouts"] },
  { name: "西蘭花苗", hints: ["broccoli sprouts"] },
  { name: "馬齒莧/長命菜", hints: ["purslane"] },
  { name: "水芹/野芹", hints: ["water celery","oenanthe"] },
  { name: "西洋菜/豆瓣菜", hints: ["watercress"] },
  { name: "香椿芽", hints: ["toona sinensis"] },

  // 41–70｜根莖塊
  { name: "紅蘿蔔", hints: ["carrot"] },
  { name: "白蘿蔔", hints: ["daikon","mooli"] },
  { name: "青蘿蔔", hints: ["green radish"] },
  { name: "紫長蘿蔔", hints: ["purple daikon"] },
  { name: "紅心蘿蔔/西瓜蘿蔔", hints: ["watermelon radish"] },
  { name: "黑蘿蔔", hints: ["black radish"] },
  { name: "甜菜根", hints: ["beet","beetroot"] },
  { name: "歐防風", hints: ["parsnip"] },
  { name: "蕪菁/蔓菁", hints: ["turnip"] },
  { name: "蕪菁葉", hints: ["turnip greens"] },
  { name: "蓮藕", hints: ["lotus root"] },
  { name: "藕帶", hints: ["young lotus stem"] },
  { name: "牛蒡", hints: ["burdock"] },
  { name: "芋頭", hints: ["taro"] },
  { name: "小芋/芋艿", hints: ["taro corms"] },
  { name: "山藥/淮山", hints: ["yam dioscorea"] },
  { name: "菊芋/洋薑", hints: ["jerusalem artichoke","sunchoke"] },
  { name: "荸薺/馬蹄", hints: ["water chestnut"] },
  { name: "芋梗", hints: ["taro stem"] },
  { name: "芹菜根/塊根芹", hints: ["celeriac"] },
  { name: "茴香球莖", hints: ["fennel bulb"] },
  { name: "薑", hints: ["ginger"] },
  { name: "蒜頭", hints: ["garlic bulb"] },
  { name: "薑黃根", hints: ["turmeric"] },
  { name: "山葵根", hints: ["wasabi"] },
  { name: "牛蒡葉", hints: ["burdock leaves"] },
  { name: "甜菜根葉", hints: ["beet greens"] },
  { name: "紫地瓜", hints: ["purple sweet potato"] },
  { name: "黃地瓜", hints: ["yellow sweet potato"] },
  { name: "新馬鈴薯", hints: ["new potato"] },

  // 71–100｜葱蒜韭（蔥屬）
  { name: "洋蔥", hints: ["onion"] },
  { name: "紫洋蔥", hints: ["red onion"] },
  { name: "青蔥", hints: ["scallion","spring onion","green onion"] },
  { name: "大蔥/韭蔥", hints: ["leek"] },
  { name: "紅蔥頭/青蔥頭", hints: ["shallot"] },
  { name: "蒜苗", hints: ["garlic sprout"] },
  { name: "蒜薹", hints: ["garlic scape"] },
  { name: "香葱", hints: ["welsh onion"] },
  { name: "藠頭/蕎頭", hints: ["allium chinense"] },
  { name: "韭菜", hints: ["chive","garlic chive"] },
  { name: "韭黃", hints: ["yellow chive"] },
  { name: "韭菜花", hints: ["chive flower"] },
  { name: "韭菜苔", hints: ["chive scape"] },
  { name: "分蔥", hints: ["shallot scallion"] },
  { name: "洋蔥苗", hints: ["spring onion bulbs"] },
  { name: "指狀馬鈴薯", hints: ["fingerling potato"] },
  { name: "紫皮馬鈴薯", hints: ["purple potato"] },
  { name: "小洋蔥/珠蔥", hints: ["pearl onion"] },
  { name: "青蒜", hints: ["green garlic"] },
  { name: "蔥白", hints: ["scallion whites"] },

  // 101–140｜瓜果類（葫蘆科等）
  { name: "小黃瓜/胡瓜", hints: ["cucumber"] },
  { name: "日本小黃瓜", hints: ["japanese cucumber"] },
  { name: "蛇瓜", hints: ["snake gourd"] },
  { name: "佛手瓜/合掌瓜", hints: ["chayote"] },
  { name: "龍鬚菜", hints: ["chayote shoots"] },
  { name: "蒲瓜/瓠瓜", hints: ["calabash","bottle gourd"] },
  { name: "節瓜/毛瓜", hints: ["hairy gourd"] },
  { name: "冬瓜", hints: ["winter melon","ash gourd"] },
  { name: "絲瓜", hints: ["luffa","loofah"] },
  { name: "南瓜", hints: ["pumpkin"] },
  { name: "栗子南瓜", hints: ["kabocha"] },
  { name: "橡實南瓜", hints: ["acorn squash"] },
  { name: "胡桃南瓜", hints: ["butternut squash"] },
  { name: "金絲瓜", hints: ["spaghetti squash"] },
  { name: "櫛瓜", hints: ["zucchini","courgette"] },
  { name: "黃西葫蘆", hints: ["yellow zucchini"] },
  { name: "金針菜", hints: ["daylily buds"] },
  { name: "秋葵", hints: ["okra","ladies finger"] },
  { name: "苦瓜", hints: ["bitter melon"] },
  { name: "白玉苦瓜", hints: ["white bitter melon"] },
  { name: "南瓜花", hints: ["pumpkin flower"] },
  { name: "西瓜嫩葉", hints: ["watermelon leaves"] },
  { name: "合掌瓜嫩梢", hints: ["chayote tendrils"] },
  { name: "水蓮", hints: ["nymphoides stem"] },
  { name: "豆薯/涼薯", hints: ["jicama"] },
  { name: "朝鮮薊", hints: ["artichoke"] },
  { name: "茭白筍/菰筍", hints: ["water bamboo"] },
  { name: "玉米", hints: ["sweet corn"] },
  { name: "玉米筍", hints: ["baby corn"] },
  { name: "竹筍", hints: ["bamboo shoot"] },
  { name: "綠竹筍", hints: ["green bamboo shoot"] },
  { name: "麻竹筍", hints: ["ma bamboo shoot"] },
  { name: "冬筍", hints: ["winter bamboo shoot"] },
  { name: "春筍", hints: ["spring bamboo shoot"] },
  { name: "蘆筍", hints: ["asparagus"] },
  { name: "綠蘆筍", hints: ["green asparagus"] },
  { name: "白蘆筍", hints: ["white asparagus"] },
  { name: "紫蘆筍", hints: ["purple asparagus"] },

  // 141–170｜茄科（番茄/茄子/椒）
  { name: "番茄", hints: ["tomato"] },
  { name: "小番茄/聖女番茄", hints: ["cherry tomato","grape tomato"] },
  { name: "牛番茄", hints: ["beefsteak tomato"] },
  { name: "羅馬番茄", hints: ["roma tomato","plum tomato"] },
  { name: "彩虹番茄混合", hints: ["mixed heirloom tomato"] },
  { name: "茄子", hints: ["eggplant","aubergine"] },
  { name: "日本長茄", hints: ["japanese eggplant"] },
  { name: "圓茄", hints: ["round eggplant"] },
  { name: "白茄", hints: ["white eggplant"] },
  { name: "青椒/甜椒/彩椒", hints: ["bell pepper","capsicum"] },
  { name: "紅甜椒", hints: ["red bell pepper"] },
  { name: "黃甜椒", hints: ["yellow bell pepper"] },
  { name: "綠甜椒", hints: ["green bell pepper"] },
  { name: "橙甜椒", hints: ["orange bell pepper"] },
  { name: "辣椒", hints: ["chili","chilli","hot pepper"] },
  { name: "朝天椒", hints: ["thai chili","facing-heaven"] },
  { name: "小米椒", hints: ["bird's eye chili"] },
  { name: "青龍椒", hints: ["long green chili"] },
  { name: "墨西哥辣椒/哈拉佩紐", hints: ["jalapeno"] },
  { name: "牛角椒/羊角椒", hints: ["longhorn pepper"] },
  { name: "甜椒粉椒", hints: ["pimiento"] },
  { name: "虎皮青椒", hints: ["shishito pepper"] },
  { name: "黃燈籠椒", hints: ["aji charapita/lantern"] },
  { name: "卡宴辣椒", hints: ["cayenne"] },
  { name: "甜香蕉椒", hints: ["banana pepper"] },
  { name: "匈牙利黃辣椒", hints: ["hungarian wax"] },
  { name: "哈瓦那辣椒", hints: ["habanero"] },
  { name: "阿納罕椒", hints: ["anaheim pepper"] },
  { name: "普布拉諾椒", hints: ["poblano"] },

  // 171–190｜豆類（莢豆/芽）
  { name: "四季豆", hints: ["green bean","string bean"] },
  { name: "菜豆", hints: ["common bean"] },
  { name: "長豆/豇豆", hints: ["yardlong bean"] },
  { name: "扁豆", hints: ["hyacinth bean"] },
  { name: "刀豆", hints: ["sword bean"] },
  { name: "皇帝豆/利馬豆", hints: ["lima bean"] },
  { name: "蠶豆", hints: ["fava bean","broad bean"] },
  { name: "毛豆/枝豆", hints: ["edamame","fresh soybean"] },
  { name: "黑豆嫩莢", hints: ["black soybean pods"] },
  { name: "豌豆/荷蘭豆", hints: ["pea","snow pea"] },
  { name: "雪豆", hints: ["snow pea"] },
  { name: "甜豆/翠玉豆", hints: ["sugar snap pea"] },
  { name: "綠豆芽", hints: ["mung bean sprouts"] },
  { name: "黃豆芽", hints: ["soybean sprouts"] },
  { name: "黑豆芽", hints: ["black bean sprouts"] },
  { name: "豌豆尖", hints: ["pea tips"] },
  { name: "菜心", hints: ["choy sum (stems)"] },
  { name: "芥藍花", hints: ["gai lan florets"] },
  { name: "油菜苔", hints: ["youcai bolting shoots"] },
  { name: "龍鬚菜梗", hints: ["tendrils of chayote"] },

  // 191–200｜香草/菇菌（常見）
  { name: "九層塔", hints: ["thai basil"] },
  { name: "甜羅勒", hints: ["genovese basil","sweet basil"] },
  { name: "紫蘇/赤紫蘇", hints: ["perilla","shiso"] },
  { name: "迷迭香", hints: ["rosemary"] },
  { name: "百里香", hints: ["thyme"] },
  { name: "鼠尾草", hints: ["sage"] },
  { name: "牛至", hints: ["oregano"] },
  { name: "蒔蘿", hints: ["dill"] },
  { name: "茴香葉", hints: ["fennel fronds"] },
  { name: "香茅", hints: ["lemongrass"] },

  // —— 菇類（常見食用菌）
  { name: "洋菇", hints: ["button mushroom","white mushroom"] },
  { name: "褐蘑菇/克里米尼", hints: ["cremini"] },
  { name: "口蘑/波特菇", hints: ["portobello"] },
  { name: "香菇", hints: ["shiitake"] },
  { name: "杏鮑菇", hints: ["king oyster mushroom","eringii"] },
  { name: "秀珍菇/平菇", hints: ["oyster mushroom"] },
  { name: "金針菇", hints: ["enoki"] },
  { name: "鴻禧菇", hints: ["shimeji","beech mushroom"] },
  { name: "雪白菇", hints: ["white shimeji"] },
  { name: "木耳", hints: ["wood ear","black fungus"] },
  { name: "銀耳/雪耳", hints: ["tremella"] },
  { name: "舞菇", hints: ["maitake"] },
  { name: "牛肝菌", hints: ["porcini"] },
  { name: "珊瑚菇", hints: ["coral fungus"] },

  // —— 其它常見/在地
  { name: "馬蘭頭", hints: ["kalimeris"] },
  { name: "過貓", hints: ["vegetable fern"] },
  { name: "山蘇", hints: ["bird's-nest fern"] },
  { name: "冰花/冰菜", hints: ["ice plant"] },
  { name: "大陸妹", hints: ["romaine (local name)"] },

  // 保底（不列入 200 種計數，但固定保留）
  { name: "其他蔬菜／待擴充", hints: ["other vegetable","unlisted veggie"] },
  { name: "非蔬菜／不確定", hints: ["not a vegetable","uncertain","background/packaging"] },
];

const pickList = (mode) => (mode === "waste" ? WASTE : VEG);

// Debug：檢查目前清單
app.get("/api/debug-categories", (req, res) => {
  const mode = (req.query.mode || "veg").toLowerCase();
  const list = pickList(mode);
  res.set("Cache-Control","no-store");
  res.json({ mode, names: list.map(x => x.name), count: list.length });
});

// ── 核心：分類（含清單外→其他蔬菜／待擴充 + raw_guess）
async function classifyImage({ image, list, domain }) {
  const listText = list.map(c => `- ${c.name}: ${(c.hints || []).join(", ")}`).join("\n");
  const prompt = (domain === "veg")
    ? `You are a vegetable image classifier for Taiwan market.
Given one photo, select the SINGLE best vegetable from the list.
Rules:
- The "top.name" MUST be EXACTLY one of the Chinese names in the list below. Do NOT invent new labels.
- If you believe it's a vegetable NOT in the list, set top.name = "其他蔬菜／待擴充" AND set top.raw_guess = your best guess (Chinese if possible).
- If it's not a vegetable or too ambiguous, set top.name = "非蔬菜／不確定" with a low score.
- Focus on raw produce; ignore plates, packaging, background, hands, table.
- Calibrate top.score in [0,1]. Higher = more confident.

Vegetable categories with hints:
${listText}`
    : `You are a waste-sorting classifier.
Choose ONE best category from the list (Chinese names). Calibrate score in [0,1].
Categories with hints:
${listText}`;

  const r = await client.responses.create({
    model: MODEL,
    temperature: 0.2, // 分類任務建議低溫度
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
                score: { type: "number" },
                raw_guess: { type: "string" } // 只有蔬菜模式會用到（可選）
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

  // 落地白名單／保底處理
  const NAMES = new Set(list.map(x => x.name));
  if (!data?.top?.name || !NAMES.has(data.top.name)) {
    if (domain === "veg") {
      const guess = data?.top?.raw_guess || data?.top?.name || "";
      data.top = { name: "其他蔬菜／待擴充", score: 0, raw_guess: guess };
    } else {
      data.top = { name: "不確定", score: 0 };
    }
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
