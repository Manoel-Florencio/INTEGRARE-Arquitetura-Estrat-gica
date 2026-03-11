import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import cors from "cors";
import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import csv from "csv-parser";
import path from "path";
import fs from "fs";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, TextRun, BorderStyle } from "docx";
import _ from "lodash";

console.log("Starting Integrar Materials AI Server v2.1...");
const CORPORATE_GRAY = "000000";
const db = new Database("integrar.db");

// Initialize Database v2.1
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    client TEXT,
    code TEXT,
    revision TEXT DEFAULT 'R00',
    project_date TEXT,
    observations TEXT,
    unification_mode TEXT DEFAULT 'global',
    total_processado INTEGER,
    total_consolidado INTEGER,
    total_duplicatas INTEGER,
    processing_time REAL,
    dados_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pavimentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id INTEGER,
    nome TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(projeto_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

// Migration for v2.1 columns
const tableInfo = db.prepare("PRAGMA table_info(projects)").all() as any[];
const columns = tableInfo.map(c => c.name);
const migrations = [
  { name: 'code', type: 'TEXT' },
  { name: 'revision', type: 'TEXT DEFAULT "R00"' },
  { name: 'unification_mode', type: 'TEXT DEFAULT "global"' },
  { name: 'processing_time', type: 'REAL' }
];

migrations.forEach(col => {
  if (!columns.includes(col.name)) {
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      console.error(`Migration error for column ${col.name}:`, e);
    }
  }
});

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Request Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext !== ".csv") {
      cb(new Error(`Arquivo inválido: ${file.originalname}. Apenas CSV do Revit é permitido.`));
      return;
    }

    cb(null, true);
  }
});
if (!fs.existsSync("uploads/")) {
  fs.mkdirSync("uploads/");
}

// --- Normalization Logic ---
const unitMap: Record<string, string> = {
  "metro": "m", "metros": "m", "m.": "m",
  "unidade": "un", "unidades": "un", "und": "un", "pc": "un", "pç": "un", "peça": "un", "peças": "un",
  "milimetro": "mm", "milimetros": "mm", "mm.": "mm",
  "centimetro": "cm", "centimetros": "cm", "cm.": "cm",
  "quilograma": "kg", "quilogramas": "kg", "kg.": "kg",
  "grama": "g", "gramas": "g", "g.": "g",
  "litro": "l", "litros": "l", "l.": "l",
  "caixa": "cx", "caixas": "cx",
  "rolo": "rl", "rolos": "rl",
  "pacote": "pct", "pacotes": "pct",
  "conjunto": "cj", "conjuntos": "cj",
  "metro linear": "ml", "metros lineares": "ml",
  "metro quadrado": "m2", "metros quadrados": "m2",
  "metro cúbico": "m3", "metros cúbicos": "m3"
};

const dictionary: Record<string, string> = {
  "soldavel": "soldável", "pvc marrom": "PVC", "tubo pvc soldavel": "Tubo Soldável PVC"
};

const normalizeText = (text: any) => {
  if (text === null || text === undefined) return "";
  let str = String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").replace(/[\r\n]+/g, " ").trim().toLowerCase();
  Object.entries(dictionary).forEach(([key, val]) => {
    if (str.includes(key)) str = str.replace(key, val.toLowerCase());
  });
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const parseDimensionForSort = (dim: string): number => {

  if (!dim) return 0;

  const match = dim.match(/\d+/);

  if (!match) return 0;

  return parseInt(match[0]);
};

const normalizeDimension = (dim: any) => {
  if (!dim) return "";
  let str = String(dim)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø|Ø|φ/gi, "")   // remove símbolo de diâmetro
    .replace(",", ".")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();

  if (/^\d+$/.test(str)) return `${str} mm`;
  if (/^\d+mm$/.test(str)) return str.replace("mm", " mm");
  if (/^\d+x\d+$/.test(str)) return str.replace("x", "x") + " mm";
  if (/^\d+x\d+mm$/.test(str)) return str.replace("mm", " mm");
  return str;
};

const normalizeUnit = (unit: any) => {
  if (!unit) return "un";
  let u = String(unit).trim().toLowerCase();
  return unitMap[u] || u;
};

const getMaterialCategory = (description: string): string => {
  const desc = description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const has = (word: string) => desc.includes(word);
  const hasAny = (words: string[]) => words.some(w => has(w));
  const hasAll = (words: string[]) => words.every(w => has(w));

  if (hasAll(["pvc", "marrom"]) || hasAll(["soldavel", "marrom"]) || hasAll(["pvc", "soldavel"]) || hasAny(["pvc marrom", "pvc soldavel", "linha soldavel", "cor marrom", "agua fria"])) {
    return "PVC Soldável Marrom";
  }
  if (hasAny(["galvanizado", "docolbase", "bsp", "rosca bsp", "metal galvanizado"])) {
    return "Aço Galvanizado";
  }
  if (hasAny(["ppr", "termofusao", "pn 20", "pn20", "tubo ppr", "linha ppr", "agua quente"])) {
    return "PPR";
  }
  if (hasAny(["esgoto sn", "serie normal", "linha esgoto sn"])) {
    return "PVC Série Normal";
  }
  if (hasAny(["esgoto sr", "serie reforcada", "linha esgoto sr"])) {
    return "PVC Série Reforçada";
  }
  return "Equipamentos";
};

const isValidMaterialRow = (description: any, dimension: any, quantity: any, unit: any) => {
  if (!description) return false;
  const desc = String(description).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const groupTitles = ["agua fria", "agua quente", "esgoto sanitario", "ventilacao", "pluvial", "redes tecnicas"];
  const qtyRaw = String(quantity || "").replace(",", ".");
  const qty = parseFloat(qtyRaw);
  if (groupTitles.some(t => desc.includes(t)) && (isNaN(qty) || qty <= 0)) return false;
  const invalidWords = ["descricao", "dimensao", "unidade", "quantidade", "total geral", "viptec"];
  if (invalidWords.some(w => desc.includes(w))) return false;
  if (desc.length < 3) return false;
  if (isNaN(qty) || qty <= 0) return false;
  return true;
};

// --- API Routes ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/projects", (req, res) => {
  const projects = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  res.json(projects);
});

app.post("/api/projects/save", (req, res) => {
  const { id, name, client, code, revision, project_date, observations, unification_mode, total_processado, total_consolidado, total_duplicatas, processing_time, dados_json, pavimentos } = req.body;

  let projectId;
  if (req.body.id) {
    // Update existing project
    const updateProject = db.prepare(`
      UPDATE projects
      SET name = ?, client = ?, code = ?, revision = ?, project_date = ?, observations = ?, unification_mode = ?, total_processado = ?, total_consolidado = ?, total_duplicatas = ?, processing_time = ?, dados_json = ?
      WHERE id = ?
    `);
    updateProject.run(name, client, code, revision, project_date, observations, unification_mode, total_processado, total_consolidado, total_duplicatas, processing_time, JSON.stringify(dados_json), req.body.id);
    projectId = req.body.id;
  } else {
    // Insert new project
    const insertProject = db.prepare(`
      INSERT INTO projects (name, client, code, revision, project_date, observations, unification_mode, total_processado, total_consolidado, total_duplicatas, processing_time, dados_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = insertProject.run(name, client, code, revision, project_date, observations, unification_mode, total_processado, total_consolidado, total_duplicatas, processing_time, JSON.stringify(dados_json));
    projectId = info.lastInsertRowid;
  }

  if (pavimentos && Array.isArray(pavimentos)) {
    const insertPav = db.prepare("INSERT INTO pavimentos (projeto_id, nome) VALUES (?, ?)");
    pavimentos.forEach((p: any) => insertPav.run(projectId, p.name));
  }

  res.json({ id: projectId, message: "Projeto salvo com sucesso" });
});

app.delete("/api/projects/:id", (req, res) => {
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.json({ message: "Projeto excluído" });
});

app.post("/api/process", upload.any(), async (req, res) => {

  console.log(">>> TESTE MANUS: O NOVO CODIGO ESTA RODANDO <<<");

  const startTime = Date.now();
  const files = (req.files as Express.Multer.File[]) || [];
  const { mode = 'global', pavimentosMetadata } = req.body;
  const pavs = JSON.parse(pavimentosMetadata || "[]");
  const pavData: Record<string, any[]> = {};
  let totalInputLines = 0;

  const processFile = async (file: Express.Multer.File) => {
    const rows: any[] = [];
    try {
      let content = fs.readFileSync(file.path, 'utf8');
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
      const lines = content.split(/\r?\n/);
      let headerIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const lowerLine = lines[i].toLowerCase();
        if (lowerLine.includes('descri') && (lowerLine.includes('quant') || lowerLine.includes('conta'))) {
          headerIndex = i;
          break;
        }
      }
      if (headerIndex === -1) return [];
      const rawHeaders = lines[headerIndex].split(';');
      const mappedHeaders = rawHeaders.map(h => {
        const norm = h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        if (norm.includes("descri")) return "description";
        if (norm.includes("dimen") || norm.includes("taman")) return "dimension";
        if (norm.includes("unid")) return "unit";
        if (norm.includes("quant") || norm.includes("conta")) return "quantity";
        return null;
      });
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith(';')) continue;
        const cells = line.split(';');
        const data: any = {};
        mappedHeaders.forEach((key, idx) => { if (key) data[key] = cells[idx]; });
        if (!isValidMaterialRow(data.description, data.dimension, data.quantity, data.unit)) continue;
        totalInputLines++;
        rows.push({
          description: String(data.description).trim(),
          dimension: data.dimension ? String(data.dimension).trim() : "",
          unit: String(data.unit || "").trim(),
          quantity: parseFloat(String(data.quantity || 0).replace(",", ".")) || 0,
          normDesc: normalizeText(data.description),
          normDim: normalizeDimension(data.dimension),
          normUnit: normalizeUnit(data.unit)
        });
      }
      return rows;
    } finally {
      try { fs.unlinkSync(file.path); } catch { }
    }
  };

  try {
    for (const pav of pavs) {
      pavData[pav.id] = [];
      const pavFiles = files.filter((f: any) => f.fieldname === `files_${pav.id}`);
      for (const file of pavFiles) {
        const rows = await processFile(file);
        pavData[pav.id].push(...rows);
      }
    }
    const consolidate = (data: any[]) => {
      const map = new Map<string, any>();
      data.forEach(item => {
        const key = `${item.normDesc}|${item.normDim}|${item.normUnit}`;
        if (map.has(key)) { map.get(key).quantity += item.quantity; } 
        else { map.set(key, { description: item.normDesc, dimension: item.normDim, unit: item.normUnit, quantity: item.quantity }); }
      });
      return Array.from(map.values()).sort((a, b) => {
        const descCompare = a.description.localeCompare(b.description);
        if (descCompare !== 0) return descCompare;
        const dimA = parseDimensionForSort(a.dimension);
        const dimB = parseDimensionForSort(b.dimension);
        return dimA - dimB;
      });
    };
    let result: any;
    if (mode === 'global') {
      result = consolidate(Object.values(pavData).flat());
    } else {
      result = { pavimentos: {}, total: consolidate(Object.values(pavData).flat()) };
      for (const pav of pavs) { result.pavimentos[pav.name] = consolidate(pavData[pav.id]); }
    }
    const totalConsolidated = mode === 'global' ? result.length : result.total.length;
    res.json({
      data: result,
      stats: { totalLines: totalInputLines, consolidatedLines: totalConsolidated, duplicatesFound: totalInputLines - totalConsolidated, processingTime: (Date.now() - startTime) / 1000 }
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Erro ao processar." });
  }
});

// --- Export Routes ---

app.post("/api/export/xlsx", async (req, res) => {
  const { project, data } = req.body;

  if (!data) {
    return res.status(400).json({ error: "Dados inválidos para exportação" });
  }
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Consolidado");
  worksheet.columns = [{ header: "Descrição", key: "description", width: 40 }, { header: "Dimensão", key: "dimension", width: 20 }, { header: "Unidade", key: "unit", width: 10 }, { header: "Quantidade", key: "quantity", width: 15 }];

  // Função auxiliar para adicionar dados agrupados por categoria
  const addGroupedDataToWorksheet = (items: any[]) => {

    const grouped = _.groupBy(items, item =>
      getMaterialCategory(item.description)
    );

    const categoriesOrder = [
      "PVC Soldável Marrom",
      "Aço Galvanizado",
      "PPR",
      "PVC Série Normal",
      "PVC Série Reforçada",
      "Equipamentos"
    ];

    categoriesOrder.forEach(category => {

      if (!grouped[category] || grouped[category].length === 0) return;

      // TÍTULO DA CATEGORIA
      const title = worksheet.addRow([category]);
      title.font = { bold: true, size: 12 };
      title.alignment = { horizontal: "center" };

      worksheet.mergeCells(title.number, 1, title.number, 4);

      // CABEÇALHO DA TABELA
      const header = worksheet.addRow([
        "Descrição",
        "Dimensão",
        "Unidade",
        "Quantidade"
      ]);

      header.font = { bold: true };

      header.alignment = {
        horizontal: "center",
        vertical: "middle"
      };

      header.border = {
        top: { style: "thin" }
      };

      // ITENS
      grouped[category].forEach((item: any) => {

        const row = worksheet.addRow([
          item.description,
          item.dimension,
          item.unit,
          item.quantity
        ]);

        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(3).alignment = { horizontal: "center" };
        row.getCell(4).alignment = { horizontal: "center" };

      });

      worksheet.addRow([]);

    });

  };

  if (project.unification_mode === "global") {
    addGroupedDataToWorksheet(data);
  } else if (data.pavimentos) {
    Object.values(data.pavimentos).forEach((items: any) => {
      addGroupedDataToWorksheet(items);
    });

    addGroupedDataToWorksheet(data.total);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();

  const buffer = Buffer.from(arrayBuffer);

  res.status(200);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="RM - ${project.name} - ${project.revision}.xlsx"`
  );
  res.setHeader("Content-Length", buffer.length);

  res.end(buffer);
});

app.post("/api/export/docx", async (req, res) => {
  try {
    const { project, data } = req.body;

    if (!data) {
      return res.status(400).json({ error: "Dados inválidos para exportação" });
    }

    const children: any[] = [];

    const addCategoryGroup = (items: any[]) => {
      const grouped = _.groupBy(items, item =>
        getMaterialCategory(item.description)
      );

      const categoriesOrder = [
        "PVC Soldável Marrom",
        "Aço Galvanizado",
        "PPR",
        "PVC Série Normal",
        "PVC Série Reforçada",
        "Equipamentos"
      ];

      categoriesOrder.forEach(category => {
        if (grouped[category] && grouped[category].length > 0) {

          // Título da categoria
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 120 },
              children: [
                new TextRun({
                  text: category,
                  bold: true,
                  size: 24,
                  font: "Garamond",
                  color: "000000"
                })
              ]
            })
          );

          // Tabela da categoria
          const tableRows = [
            new TableRow({
              children: ["Descrição", "Dimensão", "Unidade", "Quantidade"].map(h => new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, font: "Garamond" })] })],
                borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "000000" } }
              }))
            }),
            ...grouped[category].map((item: any) => new TableRow({
              children: [item.description, item.dimension, item.unit, String(item.quantity)].map(v => new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v, font: "Garamond" })] })]
              }))
            }))
          ];

          children.push(
            new Table({
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
              rows: tableRows,
            })
          );

          children.push(
            new Paragraph({
              children: [new TextRun(" ")]
            })
          );
        }
      });
    };

    // Título principal
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: `RM - ${project.name} - ${project.revision}`, bold: true, size: 28, font: "Garamond" })] }));

    if (project.unification_mode === "global") {
      addCategoryGroup(data);
    } else if (data.pavimentos) {
      Object.entries(data.pavimentos).forEach(([name, items]: [string, any]) => {
        children.push(new Paragraph({ children: [new TextRun({ text: `PAVIMENTO ${name.toUpperCase()}`, bold: true, size: 22, font: "Garamond" })] }));
        addCategoryGroup(items);
      });
      children.push(new Paragraph({ children: [new TextRun({ text: "TOTAL GERAL CONSOLIDADO", bold: true, size: 24, font: "Garamond" })] }));
      addCategoryGroup(data.total);
    }

    const doc = new Document({ sections: [{ children }] });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="RM - ${project.name} - ${project.revision}.docx"`
    );

    res.send(buffer);

  } catch (error: any) {
    console.error("DOCX Export Error:", error);
    res.status(500).json({ error: "Erro ao gerar DOCX" });
  }
});

// Catch-all for API routes to prevent falling through to Vite
app.all("/api/*", (req, res) => {
  console.warn(`API Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: `API Route ${req.method} ${req.url} not found.` });
});


// Vite middleware
//if (process.env.NODE_ENV !== "production") {
// const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
// app.use(vite.middlewares);
//} else {
// app.use(express.static("dist"));
// app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
//}

app.get("/", (req, res) => {
  res.json({
    message: "Integrare Materials AI API",
    status: "online"
  });
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: err.message || "Erro interno no servidor." });
});

app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
