const path = require("path");
const PptxGenJS = require("pptxgenjs");
const { imageSizingCrop, imageSizingContain } = require("./pptxgenjs_helpers/image");
const {
  warnIfSlideHasOverlaps,
  warnIfSlideElementsOutOfBounds,
} = require("./pptxgenjs_helpers/layout");
const { safeOuterShadow } = require("./pptxgenjs_helpers/util");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.company = "Neon Cleaner Team";
pptx.subject = "霓虹清道夫项目概览";
pptx.title = "霓虹清道夫 / Neon Cleaner 项目概览";
pptx.lang = "zh-CN";
pptx.theme = {
  headFontFace: "Microsoft YaHei",
  bodyFontFace: "Microsoft YaHei",
  lang: "zh-CN",
};

const W = 13.333;
const H = 7.5;

const COLORS = {
  bg: "090B12",
  panel: "111827",
  panel2: "162031",
  panel3: "1B2940",
  line: "2B3A55",
  text: "F5F7FA",
  sub: "A8B3C7",
  faint: "6E7B91",
  cyan: "25E3D3",
  cyanDark: "143A40",
  magenta: "D95BFF",
  magentaDark: "381C47",
  amber: "F4B95E",
  amberDark: "4A3314",
  green: "54D39A",
  greenDark: "173628",
  red: "FF6B7D",
  redDark: "4B1E27",
  white10: "FFFFFF",
};

const ROOT = path.resolve(__dirname, "..", "..", "..");
const WORLD_IMG = path.join(
  ROOT,
  "source",
  "storyboard",
  "approved",
  "SB-A0-01_establishing_world.png"
);
const HERO_IMG = path.join(ROOT, "web", "assets", "女主.png");
const OUTPUT = path.join(__dirname, "Neon_Cleaner_Project_Overview_2026-06-09.pptx");

function addFullBg(slide, color = COLORS.bg) {
  slide.background = { color };
}

function addPageTag(slide, text) {
  slide.addText(text, {
    x: 11.95,
    y: 0.22,
    w: 1.0,
    h: 0.22,
    fontFace: "Microsoft YaHei",
    fontSize: 8,
    color: COLORS.faint,
    align: "right",
    margin: 0,
  });
}

function addHeader(slide, title, subtitle = "") {
  slide.addText(title, {
    x: 0.65,
    y: 0.38,
    w: 6.8,
    h: 0.5,
    fontFace: "Microsoft YaHei",
    bold: true,
    fontSize: 25,
    color: COLORS.text,
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.68,
      y: 0.9,
      w: 7.8,
      h: 0.28,
      fontFace: "Microsoft YaHei",
      fontSize: 10,
      color: COLORS.sub,
      margin: 0,
    });
  }
  slide.addShape(pptx.ShapeType.line, {
    x: 0.65,
    y: 1.22,
    w: 12.0,
    h: 0,
    line: { color: COLORS.line, width: 1.2 },
  });
}

function addChip(slide, text, x, y, w, fill, color = COLORS.text) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.34,
    rectRadius: 0.06,
    fill: { color: fill },
    line: { color: fill, transparency: 100 },
  });
  slide.addText(text, {
    x: x + 0.08,
    y: y + 0.03,
    w: w - 0.16,
    h: 0.22,
    fontFace: "Microsoft YaHei",
    fontSize: 9,
    color,
    bold: true,
    align: "center",
    margin: 0,
  });
}

function addCard(slide, opts) {
  const {
    x,
    y,
    w,
    h,
    title,
    body,
    fill = COLORS.panel,
    titleColor = COLORS.text,
    bodyColor = COLORS.sub,
    accent = COLORS.cyan,
  } = opts;
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: COLORS.line, width: 1 },
    shadow: safeOuterShadow("000000", 0.18, 45, 2, 1),
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: x + 0.02,
    y: y + 0.02,
    w: 0.08,
    h: h - 0.04,
    fill: { color: accent },
    line: { color: accent, transparency: 100 },
  });
  slide.addText(title, {
    x: x + 0.18,
    y: y + 0.14,
    w: w - 0.32,
    h: 0.34,
    fontFace: "Microsoft YaHei",
    bold: true,
    fontSize: 14,
    color: titleColor,
    margin: 0,
  });
  slide.addText(body, {
    x: x + 0.18,
    y: y + 0.52,
    w: w - 0.28,
    h: h - 0.64,
    fontFace: "Microsoft YaHei",
    fontSize: 10.5,
    color: bodyColor,
    valign: "top",
    margin: 0,
    breakLine: false,
  });
}

function addBulletRow(slide, x, y, w, text, color = COLORS.sub, dot = COLORS.cyan) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y: y + 0.08,
    w: 0.09,
    h: 0.09,
    fill: { color: dot },
    line: { color: dot, transparency: 100 },
  });
  slide.addText(text, {
    x: x + 0.18,
    y,
    w: w - 0.18,
    h: 0.24,
    fontFace: "Microsoft YaHei",
    fontSize: 11,
    color,
    margin: 0,
  });
}

function addNode(slide, x, y, w, h, label, sub, fill, accent) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: accent, width: 1.5 },
  });
  slide.addText(label, {
    x: x + 0.08,
    y: y + 0.12,
    w: w - 0.16,
    h: 0.26,
    fontFace: "Microsoft YaHei",
    fontSize: 12,
    bold: true,
    color: COLORS.text,
    align: "center",
    margin: 0,
  });
  slide.addText(sub, {
    x: x + 0.08,
    y: y + 0.46,
    w: w - 0.16,
    h: 0.22,
    fontFace: "Microsoft YaHei",
    fontSize: 8.5,
    color: COLORS.sub,
    align: "center",
    margin: 0,
  });
}

function addFlowConnector(slide, x1, y1, x2, y2, color = COLORS.line) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: { color, width: 1.4, beginArrowType: "none", endArrowType: "triangle" },
  });
}

function finalizeSlide(slide) {
  warnIfSlideHasOverlaps(slide, pptx);
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

function buildSlides() {
  // Slide 1
  {
    const slide = pptx.addSlide();
    addFullBg(slide);
    // Intentional overlay pair: full-bleed key art with a dark rect on top for readability.
    slide.addImage({
      path: WORLD_IMG,
      ...imageSizingCrop(WORLD_IMG, 0, 0, W, H),
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: W,
      h: H,
      fill: { color: "05070B", transparency: 34 },
      line: { color: "05070B", transparency: 100 },
    });
    slide.addText("内部同步稿 · 2026/06/09", {
      x: 0.7,
      y: 0.58,
      w: 2.2,
      h: 0.24,
      fontFace: "Microsoft YaHei",
      fontSize: 9,
      color: COLORS.cyan,
      bold: true,
      margin: 0,
    });
    slide.addText("霓虹清道夫", {
      x: 0.68,
      y: 1.02,
      w: 4.8,
      h: 0.72,
      fontFace: "Microsoft YaHei",
      fontSize: 28,
      bold: true,
      color: COLORS.text,
      margin: 0,
    });
    slide.addText("Neon Cleaner", {
      x: 0.7,
      y: 1.78,
      w: 3.4,
      h: 0.34,
      fontFace: "Microsoft YaHei",
      fontSize: 15,
      color: COLORS.sub,
      margin: 0,
    });
    slide.addText("一个“电影观看 + 关键片段接管 + 分支影片结果”的互动电影游戏原型", {
      x: 0.7,
      y: 2.3,
      w: 5.9,
      h: 0.65,
      fontFace: "Microsoft YaHei",
      fontSize: 14,
      color: COLORS.text,
      margin: 0,
      breakLine: false,
    });
    addChip(slide, "AI电影互动游戏", 0.7, 3.12, 1.55, COLORS.cyanDark, COLORS.cyan);
    addChip(slide, "赛博 noir", 2.35, 3.12, 1.05, COLORS.magentaDark, COLORS.magenta);
    addChip(slide, "动作惊悚", 3.52, 3.12, 1.05, COLORS.amberDark, COLORS.amber);
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 7.55,
      y: 0.98,
      w: 5.05,
      h: 2.1,
      rectRadius: 0.08,
      fill: { color: "0C121C", transparency: 18 },
      line: { color: "FFFFFF", transparency: 82, width: 1 },
    });
    slide.addText("一句话卖点", {
      x: 7.82,
      y: 1.22,
      w: 1.2,
      h: 0.25,
      fontFace: "Microsoft YaHei",
      fontSize: 9,
      color: COLORS.cyan,
      bold: true,
      margin: 0,
    });
    slide.addText("先用电影镜头把人抓住，再在最想插手的动作节点交出控制权。玩家的操作，不是改一行台词，而是改接下来看到的影片结果。", {
      x: 7.82,
      y: 1.54,
      w: 4.45,
      h: 1.18,
      fontFace: "Microsoft YaHei",
      fontSize: 13,
      color: COLORS.text,
      margin: 0,
      breakLine: false,
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.7,
      y: 5.78,
      w: 7.5,
      h: 0.92,
      rectRadius: 0.06,
      fill: { color: "0A0F17", transparency: 12 },
      line: { color: COLORS.line, width: 1 },
    });
    slide.addText("目标不是做一个“像 3A 的小游戏”，而是验证一种新形态：高电影感、低上手门槛、强传播性、可快速扩镜头与分支的互动体验。", {
      x: 0.9,
      y: 6.04,
      w: 7.1,
      h: 0.42,
      fontFace: "Microsoft YaHei",
      fontSize: 11,
      color: COLORS.sub,
      margin: 0,
      breakLine: false,
    });
    addPageTag(slide, "01");
    finalizeSlide(slide);
  }

  // Slide 2
  {
    const slide = pptx.addSlide();
    addFullBg(slide);
    addHeader(slide, "我们在做什么", "不是纯 AI 短片，也不是传统小游戏，而是一个“先看后接管”的互动电影原型");

    addCard(slide, {
      x: 0.68,
      y: 1.5,
      w: 4.0,
      h: 2.05,
      title: "项目定义",
      body: "用户先被电影片段吸引，再在关键动作节点短暂接管主角。操作表现会改变后续影片路径，而不是只改变 UI 数值或一句对白。",
      accent: COLORS.cyan,
    });
    addCard(slide, {
      x: 0.68,
      y: 3.82,
      w: 4.0,
      h: 2.05,
      title: "体验核心",
      body: "把“观看”与“插手”合成一条流。玩家不是一直玩，也不是一直看，而是在最有冲动的瞬间真正进入故事。",
      accent: COLORS.magenta,
    });

    slide.addText("核心循环", {
      x: 5.15,
      y: 1.45,
      w: 1.3,
      h: 0.24,
      fontFace: "Microsoft YaHei",
      fontSize: 11,
      color: COLORS.cyan,
      bold: true,
      margin: 0,
    });
    const loopY = 2.1;
    addNode(slide, 5.0, loopY, 1.6, 0.92, "电影片段", "建立人物、世界、目标", COLORS.panel, COLORS.cyan);
    addNode(slide, 6.9, loopY, 1.6, 0.92, "接管窗口", "在最想插手时交控制权", COLORS.panel, COLORS.magenta);
    addNode(slide, 8.8, loopY, 1.6, 0.92, "玩家操作", "驾驶 / 闪避 / 打断", COLORS.panel, COLORS.amber);
    addNode(slide, 10.7, loopY, 1.6, 0.92, "分支影片", "爽感 / 代价 / 遗憾", COLORS.panel, COLORS.green);
    addFlowConnector(slide, 6.6, 2.56, 6.9, 2.56);
    addFlowConnector(slide, 8.5, 2.56, 8.8, 2.56);
    addFlowConnector(slide, 10.4, 2.56, 10.7, 2.56);

    addCard(slide, {
      x: 5.02,
      y: 3.85,
      w: 2.32,
      h: 1.48,
      title: "不是短片",
      body: "观众不只是看完走人，关键时刻能真正插手。",
      accent: COLORS.red,
    });
    addCard(slide, {
      x: 7.5,
      y: 3.85,
      w: 2.32,
      h: 1.48,
      title: "不是小游戏",
      body: "不是靠数值堆时长，而是靠高密度戏剧场景推进。",
      accent: COLORS.red,
    });
    addCard(slide, {
      x: 9.98,
      y: 3.85,
      w: 2.32,
      h: 1.48,
      title: "不是 3A 仿品",
      body: "不在系统量级上硬碰，而在体验效率和传播效率上取胜。",
      accent: COLORS.red,
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 5.02,
      y: 5.62,
      w: 7.28,
      h: 0.84,
      rectRadius: 0.05,
      fill: { color: COLORS.panel2 },
      line: { color: COLORS.line, width: 1 },
    });
    slide.addText("一句话：我们在做的是“可玩的 AI 电影”，而不是“带视频背景的普通关卡游戏”。", {
      x: 5.25,
      y: 5.9,
      w: 6.8,
      h: 0.24,
      fontFace: "Microsoft YaHei",
      fontSize: 11,
      color: COLORS.text,
      margin: 0,
    });

    addPageTag(slide, "02");
    finalizeSlide(slide);
  }

  // Slide 3
  {
    const slide = pptx.addSlide();
    addFullBg(slide);
    addHeader(slide, "世界观与故事", "先让同事明白我们在讲一个什么世界、谁在追什么、为什么要接管");

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.68,
      y: 1.46,
      w: 7.5,
      h: 4.95,
      rectRadius: 0.08,
      fill: { color: COLORS.panel },
      line: { color: COLORS.line, width: 1 },
    });
    slide.addText("2037 年，旧金山被长期冲突撕裂。表面上，城市里的事故像是普通车祸、火灾和设备故障；更深层里，证据正在被系统性改写，远处的战火则隐约暴露出更大的碳基生命与硅基生命对抗。", {
      x: 0.95,
      y: 1.76,
      w: 6.95,
      h: 0.88,
      fontFace: "Microsoft YaHei",
      fontSize: 12.2,
      color: COLORS.text,
      margin: 0,
      breakLine: false,
    });
    addBulletRow(slide, 0.98, 2.95, 6.8, "林夏：前特技车手，现为城市清道夫，擅长驾驶、短兵战斗和现场判断。");
    addBulletRow(slide, 0.98, 3.35, 6.8, "阿洛：车载 AI 助手，负责标记路线、计算风险、辅助判断。", COLORS.sub, COLORS.amber);
    addBulletRow(slide, 0.98, 3.75, 6.8, "维克多：安保负责人，负责转运和掩盖污染核心，是当前阶段的主要对手。", COLORS.sub, COLORS.red);
    addBulletRow(slide, 0.98, 4.15, 6.8, "米娅：内部证人，掌握原始视频与关键证据，是故事推进的引爆点。", COLORS.sub, COLORS.green);
    slide.addText("故事驱动力不是“打怪升级”，而是：\n林夏必须在混乱和伪装中追上真相，在最晚的时刻把证据从系统手里抢回来。", {
      x: 0.98,
      y: 4.82,
      w: 6.7,
      h: 0.82,
      fontFace: "Microsoft YaHei",
      fontSize: 11.2,
      color: COLORS.sub,
      margin: 0,
    });
    addChip(slide, "赛博 noir", 1.0, 5.76, 1.05, COLORS.magentaDark, COLORS.magenta);
    addChip(slide, "电影动作惊悚", 2.16, 5.76, 1.42, COLORS.amberDark, COLORS.amber);
    addChip(slide, "战后旧金山", 3.68, 5.76, 1.25, COLORS.cyanDark, COLORS.cyan);
    addChip(slide, "分支结果可感知", 5.04, 5.76, 1.55, COLORS.greenDark, COLORS.green);

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 8.48,
      y: 1.46,
      w: 4.15,
      h: 4.95,
      rectRadius: 0.08,
      fill: { color: COLORS.panel2 },
      line: { color: COLORS.line, width: 1 },
    });
    slide.addImage({
      path: HERO_IMG,
      ...imageSizingContain(HERO_IMG, 8.72, 1.7, 3.68, 4.45),
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 8.48,
      y: 5.72,
      w: 4.15,
      h: 0.69,
      fill: { color: COLORS.magentaDark, transparency: 12 },
      line: { color: COLORS.line, width: 0.5 },
    });
    slide.addText("林夏不是“酷角色摆拍”，而是人类侧仍在反击的具象化代表。", {
      x: 8.72,
      y: 5.94,
      w: 3.72,
      h: 0.22,
      fontFace: "Microsoft YaHei",
      fontSize: 10.2,
      color: COLORS.text,
      margin: 0,
      align: "center",
    });

    addPageTag(slide, "03");
    finalizeSlide(slide);
  }

  // Slide 4
  {
    const slide = pptx.addSlide();
    addFullBg(slide);
    addHeader(slide, "Demo 内容结构", "用最少的节点证明这条形态成立：世界建立、接管爽点、分支反馈、高潮对峙");

    slide.addText("主线骨架", {
      x: 0.68,
      y: 1.45,
      w: 1.2,
      h: 0.24,
      fontFace: "Microsoft YaHei",
      fontSize: 11,
      color: COLORS.cyan,
      bold: true,
      margin: 0,
    });

    addNode(slide, 0.8, 2.28, 1.55, 0.95, "A0 开场", "电影 · 建立城市 / 主角 / 车队", COLORS.panel, COLORS.cyan);
    addNode(slide, 2.55, 2.28, 1.55, 0.95, "I1 追车", "接管 · 速度 / 车道 / 反应", COLORS.panel, COLORS.magenta);
    addNode(slide, 7.05, 2.28, 1.55, 0.95, "A2 仓库", "电影 · 上传威胁 / Boss 前奏", COLORS.panel, COLORS.cyan);
    addNode(slide, 8.85, 2.28, 1.55, 0.95, "I2 Boss", "接管 · 战斗与打断上传", COLORS.panel, COLORS.magenta);

    addNode(slide, 4.45, 1.48, 1.75, 0.75, "C1 完美追上", "爽感最强", COLORS.greenDark, COLORS.green);
    addNode(slide, 4.45, 2.38, 1.75, 0.75, "C2 受损追上", "成功但有代价", COLORS.amberDark, COLORS.amber);
    addNode(slide, 4.45, 3.28, 1.75, 0.75, "C3 跟丢迟到", "遗憾与补救", COLORS.redDark, COLORS.red);

    addNode(slide, 10.95, 1.48, 1.6, 0.75, "E1 最优结局", "救人 + 保住证据", COLORS.greenDark, COLORS.green);
    addNode(slide, 10.95, 2.38, 1.6, 0.75, "E2 代价胜利", "救人但对手逃走", COLORS.amberDark, COLORS.amber);
    addNode(slide, 10.95, 3.28, 1.6, 0.75, "E3 遗憾结局", "救援失败或真相被污染", COLORS.redDark, COLORS.red);

    addFlowConnector(slide, 2.35, 2.75, 2.55, 2.75);
    addFlowConnector(slide, 6.2, 2.75, 7.05, 2.75);
    addFlowConnector(slide, 8.6, 2.75, 8.85, 2.75);

    slide.addShape(pptx.ShapeType.line, {
      x: 4.1,
      y: 1.85,
      w: 0.35,
      h: 0.9,
      line: { color: COLORS.line, width: 1.2 },
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 4.1,
      y: 2.75,
      w: 0.35,
      h: 0,
      line: { color: COLORS.line, width: 1.2 },
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 4.1,
      y: 2.75,
      w: 0.35,
      h: 0.9,
      line: { color: COLORS.line, width: 1.2 },
    });

    slide.addShape(pptx.ShapeType.line, {
      x: 10.45,
      y: 1.85,
      w: 0.5,
      h: 0.9,
      line: { color: COLORS.line, width: 1.2, endArrowType: "triangle" },
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 10.45,
      y: 2.75,
      w: 0.5,
      h: 0,
      line: { color: COLORS.line, width: 1.2, endArrowType: "triangle" },
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 10.45,
      y: 2.75,
      w: 0.5,
      h: 0.9,
      line: { color: COLORS.line, width: 1.2, endArrowType: "triangle" },
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.8,
      y: 5.12,
      w: 11.75,
      h: 0.98,
      rectRadius: 0.05,
      fill: { color: COLORS.panel2 },
      line: { color: COLORS.line, width: 1 },
    });
    slide.addText("关键不是节点多，而是接管点准：\n追车、爆炸躲避、Boss 打断上传，这些都是观众“最想亲手介入”的瞬间。", {
      x: 1.05,
      y: 5.36,
      w: 11.2,
      h: 0.42,
      fontFace: "Microsoft YaHei",
      fontSize: 11.2,
      color: COLORS.text,
      margin: 0,
    });

    addPageTag(slide, "04");
    finalizeSlide(slide);
  }

  // Slide 5
  {
    const slide = pptx.addSlide();
    addFullBg(slide);
    addHeader(slide, "卖点是什么", "真正要讲给同事听的，不是技术名词，而是用户为什么会被这套东西吸住");

    addCard(slide, {
      x: 0.72,
      y: 1.55,
      w: 3.0,
      h: 1.7,
      title: "1. 先抓眼球",
      body: "先用电影镜头、世界规模和角色出场把人拉进来，再谈玩法，不要求玩家先读规则。",
      accent: COLORS.cyan,
    });
    addCard(slide, {
      x: 3.98,
      y: 1.55,
      w: 3.0,
      h: 1.7,
      title: "2. 接管时机准",
      body: "不是到处插小游戏，而是在追车、躲避、Boss 打断这些真正有冲动的节点交控制权。",
      accent: COLORS.magenta,
    });
    addCard(slide, {
      x: 7.24,
      y: 1.55,
      w: 3.0,
      h: 1.7,
      title: "3. 后果可感知",
      body: "玩家的表现会进入不同电影分支，爽感、代价和遗憾是能看见的，而不是只在数值表里变化。",
      accent: COLORS.amber,
    });
    addCard(slide, {
      x: 10.5,
      y: 1.55,
      w: 2.1,
      h: 1.7,
      title: "4. 易传播",
      body: "短、强、可分享，天然适合网页和移动端传播。",
      accent: COLORS.green,
    });

    addCard(slide, {
      x: 0.72,
      y: 3.63,
      w: 5.85,
      h: 1.78,
      title: "内容卖点：电影感不是背景，互动不是附属",
      body: "电影负责建立世界、人物与情绪，互动负责把“我想插手”变成真正的玩法。两者不是拼盘，而是互相放大。",
      accent: COLORS.cyan,
    });
    addCard(slide, {
      x: 6.82,
      y: 3.63,
      w: 5.78,
      h: 1.78,
      title: "制作卖点：先静帧、再视频、再接入玩法",
      body: "当前管线已经明确：分镜静帧 -> 审批 -> 图生视频 -> 接入网页 demo。内容可以持续扩镜头、扩分支，而不是一次赌一个长片。",
      accent: COLORS.magenta,
    });

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.72,
      y: 5.8,
      w: 11.88,
      h: 0.82,
      rectRadius: 0.05,
      fill: { color: COLORS.panel3 },
      line: { color: COLORS.line, width: 1 },
    });
    slide.addText("一句话总结：这是一个“电影吸引力 × 游戏参与感 × AI 内容生产效率”同时成立的项目。", {
      x: 1.02,
      y: 6.07,
      w: 11.3,
      h: 0.24,
      fontFace: "Microsoft YaHei",
      fontSize: 11.2,
      color: COLORS.text,
      margin: 0,
      align: "center",
    });

    addPageTag(slide, "05");
    finalizeSlide(slide);
  }

  // Slide 6
  {
    const slide = pptx.addSlide();
    addFullBg(slide);
    addHeader(slide, "相比 3A 的优势", "不是替代 3A，而是在当前团队规模和目标下，用不同打法拿到更高的体验与验证效率");

    const xCols = [0.72, 3.05, 6.2];
    const widths = [2.15, 3.0, 5.95];
    const rowH = 0.73;
    const startY = 1.6;
    const headerFill = COLORS.panel3;
    const rows = [
      ["维度", "传统 3A 长项", "Neon Cleaner 的错位优势"],
      ["上手门槛", "玩家通常需要先学系统、读 UI、进教程。", "先看电影即可进入情境，接管只发生在最关键的动作节点。"],
      ["内容生产", "高成本长链路，单条分支和单个场景都很贵。", "先静帧锁镜头，再图生视频，分支扩充成本明显更低。"],
      ["爽点密度", "节奏往往要靠长时间铺垫。", "短时高密度：世界、追车、爆炸、Boss、结局反馈集中释放。"],
      ["传播适配", "更适合主机/PC 深度游玩，分享门槛高。", "天然适合网页、移动端和短视频传播，先让人愿意点开。"],
      ["验证速度", "验证一个完整体验回路通常更慢。", "可以很快验证“电影感 + 接管感 + 分支反馈”是否成立。"],
    ];

    for (let r = 0; r < rows.length; r++) {
      const y = startY + r * rowH;
      const isHeader = r === 0;
      for (let c = 0; c < 3; c++) {
        slide.addShape(pptx.ShapeType.rect, {
          x: xCols[c],
          y,
          w: widths[c],
          h: rowH,
          fill: { color: isHeader ? headerFill : r % 2 === 0 ? COLORS.panel2 : COLORS.panel },
          line: { color: COLORS.line, width: 1 },
        });
        slide.addText(rows[r][c], {
          x: xCols[c] + 0.12,
          y: y + 0.14,
          w: widths[c] - 0.24,
          h: rowH - 0.18,
          fontFace: "Microsoft YaHei",
          fontSize: isHeader ? 11 : 10.2,
          bold: isHeader || c === 0,
          color: isHeader ? COLORS.text : c === 0 ? COLORS.text : COLORS.sub,
          valign: "mid",
          margin: 0,
        });
      }
    }

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.72,
      y: 6.22,
      w: 11.43,
      h: 0.74,
      rectRadius: 0.05,
      fill: { color: COLORS.magentaDark },
      line: { color: COLORS.magenta, width: 1 },
    });
    slide.addText("关键话术：我们不是在“系统深度”上跟 3A 正面对打，而是在“体验效率、内容效率、传播效率”上更有机会打出新形态。", {
      x: 0.98,
      y: 6.46,
      w: 10.9,
      h: 0.24,
      fontFace: "Microsoft YaHei",
      fontSize: 10.8,
      color: COLORS.text,
      margin: 0,
      align: "center",
    });

    addPageTag(slide, "06");
    finalizeSlide(slide);
  }

  // Slide 7
  {
    const slide = pptx.addSlide();
    addFullBg(slide);
    addHeader(slide, "当前进展与下一步", "这不是纯概念：已经有可玩原型、视频管线和分镜方向，接下来是把关键镜头和 handoff 做实");

    addCard(slide, {
      x: 0.72,
      y: 1.55,
      w: 5.55,
      h: 4.85,
      title: "当前已完成",
      body: "",
      accent: COLORS.green,
    });
    addBulletRow(slide, 1.02, 2.08, 4.9, "网页互动 demo 已可运行：开场、追车接管、Boss 接管、三结局。", COLORS.text, COLORS.green);
    addBulletRow(slide, 1.02, 2.55, 4.9, "本地 Sulphur2 / LTX-2.3 视频环境已跑通。", COLORS.text, COLORS.green);
    addBulletRow(slide, 1.02, 3.02, 4.9, "世界建立镜头已批准：战后旧金山高架体系与战争氛围确立。", COLORS.text, COLORS.green);
    addBulletRow(slide, 1.02, 3.49, 4.9, "分镜优先管线已明确：静帧审批 -> I2V -> 接入玩法。", COLORS.text, COLORS.green);
    addBulletRow(slide, 1.02, 3.96, 4.9, "ClipAI / Kling / 本地 ComfyUI 的镜头包已开始沉淀。", COLORS.text, COLORS.green);
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 1.02,
      y: 4.62,
      w: 4.95,
      h: 1.28,
      rectRadius: 0.05,
      fill: { color: COLORS.panel2 },
      line: { color: COLORS.line, width: 1 },
    });
    slide.addText("一句话状态：\n我们已经从“概念讨论”进入“可持续生产镜头并验证互动 handoff”的阶段。", {
      x: 1.26,
      y: 4.9,
      w: 4.45,
      h: 0.62,
      fontFace: "Microsoft YaHei",
      fontSize: 11,
      color: COLORS.text,
      margin: 0,
      align: "center",
    });

    addCard(slide, {
      x: 6.58,
      y: 1.55,
      w: 6.02,
      h: 2.18,
      title: "接下来最重要的 3 件事",
      body: "1. 锁定 A0 前四镜：世界、林夏、敌方车队、点火进入追击。\n2. 用通过镜头替换网页 demo 中的临时视频与占位画面。\n3. 强化追车与 Boss 的 movie-to-play handoff，让“切到玩法”更自然。",
      accent: COLORS.cyan,
    });
    addCard(slide, {
      x: 6.58,
      y: 3.95,
      w: 6.02,
      h: 1.42,
      title: "最适合同事加入的方向",
      body: "分镜筛图、角色镜头、敌车设定、动作设计、追车可玩性、剪辑拼接、网页表现与性能优化。",
      accent: COLORS.magenta,
    });
    addCard(slide, {
      x: 6.58,
      y: 5.6,
      w: 6.02,
      h: 0.82,
      title: "内部沟通建议",
      body: "先统一：我们不是在做“AI 短片”，而是在做“可玩的 AI 电影”。",
      accent: COLORS.amber,
    });

    addPageTag(slide, "07");
    finalizeSlide(slide);
  }
}

async function main() {
  buildSlides();
  await pptx.writeFile({ fileName: OUTPUT });
  console.log(`Wrote deck to ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
