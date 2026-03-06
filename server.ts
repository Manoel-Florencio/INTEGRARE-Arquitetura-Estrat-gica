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
const CORPORATE_GRAY = "666666";
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
  const lowerDim = dim.toLowerCase();
  // Handle common fractions
  if (lowerDim.includes("1/2")) return 0.5;
  if (lowerDim.includes("1/4")) return 0.25;
  if (lowerDim.includes("3/4")) return 0.75;
  // Extract numeric part
  const match = lowerDim.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
};

const normalizeDimension = (dim: any) => {
  if (!dim) return "";
  let str = String(dim).trim().replace(/(\d+)\s*(mm|m|cm|pol|")/gi, "$1 $2").toLowerCase();
  // Add more specific normalizations if needed, e.g., "pol" to "polegada"
  return str;
};

const normalizeUnit = (unit: any) => {
  if (!unit) return "un";
  let u = String(unit).trim().toLowerCase();
  return unitMap[u] || u;
};
const getMaterialCategory = (description: string): string => {

  const desc = description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  // helpers
  const has = (word: string) => desc.includes(word);

  const hasAny = (words: string[]) => words.some(w => has(w));

  const hasAll = (words: string[]) => words.every(w => has(w));

  // ================================
  // 1️⃣ PVC SOLDÁVEL MARROM
  // ================================

  const pvcWords = ["pvc"];
  const marromWords = ["marrom", "marron"];
  const soldavelWords = ["soldavel", "solda", "linha soldavel"];
  const aguaFriaWords = ["agua fria"];

  if (

    hasAll(["pvc", "marrom"]) ||

    hasAll(["soldavel", "marrom"]) ||

    hasAll(["pvc", "soldavel"]) ||

    hasAny([
      "pvc marrom",
      "pvc soldavel",
      "linha soldavel",
      "cor marrom"
    ]) ||

    (hasAny(pvcWords) && hasAny(marromWords)) ||

    (hasAny(soldavelWords) && hasAny(marromWords)) ||

    (hasAny(pvcWords) && hasAny(soldavelWords)) ||

    (hasAny(aguaFriaWords) && hasAny(pvcWords))

  ) {
    return "PVC Soldável Marrom";
  }

  // ================================
  // 2️⃣ AÇO GALVANIZADO
  // ================================

  const galvanizadoWords = [
    "galvanizado",
    "docolbase",
    "bsp",
    "rosca bsp",
    "metal galvanizado"
  ];

  if (hasAny(galvanizadoWords)) {
    return "Aço Galvanizado";
  }

  // ================================
  // 3️⃣ PPR
  // ================================

  const pprWords = [
    "ppr",
    "termofusao",
    "pn 20",
    "pn20",
    "tubo ppr",
    "linha ppr",
    "agua quente"
  ];

  if (hasAny(pprWords)) {
    return "PPR";
  }

  // ================================
  // 4️⃣ PVC ESGOTO SN
  // ================================

  const esgotoSNWords = [
    "esgoto sn",
    "serie normal",
    "linha esgoto sn"
  ];

  if (hasAny(esgotoSNWords)) {
    return "PVC Série Normal";
  }

  // ================================
  // 5️⃣ PVC ESGOTO SR
  // ================================

  const esgotoSRWords = [
    "esgoto sr",
    "serie reforcada",
    "linha esgoto sr"
  ];

  if (hasAny(esgotoSRWords)) {
    return "PVC Série Reforçada";
  }

  // ================================
  // 6️⃣ EQUIPAMENTOS
  // ================================

  return "Equipamentos";
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
  const startTime = Date.now();

  if (process.env.NODE_ENV !== "production") {
    console.log("Processing request body keys:", Object.keys(req.body));
    console.log("Processing files count:", (req.files as any)?.length || 0);
  }

  const files = (req.files as Express.Multer.File[]) || [];
  const { mode = 'global', pavimentosMetadata } = req.body;

  const pavs = JSON.parse(pavimentosMetadata || "[]");
  const pavData: Record<string, any[]> = {};
  let totalInputLines = 0;

  const processFile = async (file: Express.Multer.File) => {
    try {
      const rows: any[] = [];

      await new Promise((resolve, reject) => {
        let headersMap: any = {};

        fs.createReadStream(file.path)
          .pipe(csv({ separator: ";", skipLines: 1 }))
          .on("headers", (headers: string[]) => {
            headers.forEach(h => {
              const normalized = h
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .trim();

              if (normalized.includes("descricao")) headersMap.description = h;
              if (normalized.includes("dimensao")) headersMap.dimension = h;
              if (normalized.includes("unidade")) headersMap.unit = h;
              if (
                normalized.includes("quantidade") ||
                normalized.includes("contagem") ||
                normalized.includes("qtde") ||
                normalized.includes("qtd")
              ) {
                headersMap.quantity = h;
              }
            });

            if (!headersMap.description || !headersMap.quantity) {
              reject(new Error(`CSV inválido: colunas obrigatórias ausentes.`));
            }
          })
          .on("data", data => {
            const description = data[headersMap.description];
            if (!description) return;

            totalInputLines++;

            rows.push({
              description: String(description).trim(),
              dimension: String(data[headersMap.dimension] || "").trim(),
              unit: String(data[headersMap.unit] || "").trim(),
              quantity: parseFloat(String(data[headersMap.quantity] || 0).replace(",", ".")) || 0,
              normDesc: normalizeText(description),
              normDim: normalizeDimension(data[headersMap.dimension]),
              normUnit: normalizeUnit(data[headersMap.unit])
            });
          })
          .on("end", resolve)
          .on("error", reject);
      });

      return rows;
    } finally {

      try {
        fs.unlinkSync(file.path);
      } catch { }
    }
  };

  try {
    console.log(`Processing ${pavs.length} pavimentos...`);
    for (const pav of pavs) {
      pavData[pav.id] = [];
      const pavFiles = files.filter((f: any) => f.fieldname === `files_${pav.id}`);
      console.log(`Pavimento ${pav.name} (${pav.id}): ${pavFiles.length} files`);
      for (const file of pavFiles) {
        const rows = await processFile(file);
        pavData[pav.id].push(...rows);
      }
    }

    const consolidate = (data: any[]) => {
      const map = new Map<string, any>();

      data.forEach(item => {
        const key = `${item.normDesc}|${item.normDim}|${item.normUnit}`;

        if (map.has(key)) {
          map.get(key).quantity += item.quantity;
        } else {
          map.set(key, {
            description: item.normDesc,
            dimension: item.normDim,
            unit: item.normUnit,
            quantity: item.quantity
          });
        }
      });

      return Array.from(map.values())
        .sort((a, b) => {
          const descCompare = a.description.localeCompare(b.description);
          if (descCompare !== 0) return descCompare;

          const dimA = parseDimensionForSort(a.dimension);
          const dimB = parseDimensionForSort(b.dimension);
          if (dimA !== dimB) return dimA - dimB;

          return a.dimension.localeCompare(b.dimension);
        });
    };

    let result: any;
    if (mode === 'global') {
      const all = Object.values(pavData).flat();
      result = consolidate(all);
    } else {
      result = { pavimentos: {}, total: consolidate(Object.values(pavData).flat()) };
      for (const pav of pavs) {
        result.pavimentos[pav.name] = consolidate(pavData[pav.id]);
      }
    }

    const totalConsolidated = mode === 'global' ? result.length : result.total.length;
    res.json({
      data: result,
      stats: { totalLines: totalInputLines, consolidatedLines: totalConsolidated, duplicatesFound: totalInputLines - totalConsolidated, processingTime: (Date.now() - startTime) / 1000 }
    });
  } catch (error: any) {
    console.error("Process Error:", error);
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
                  color: CORPORATE_GRAY,
                  font: "Calibri"
                })
              ]
            })
          );

          // Tabela da categoria
          const tableRows = [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: "Descrição",
                          bold: true,
                          color: CORPORATE_GRAY,
                          font: "Calibri"
                        })
                      ]
                    })
                  ],
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: "999999" }
                  }
                }),

                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: "Dimensão",
                          bold: true,
                          color: CORPORATE_GRAY,
                          font: "Calibri"
                        })
                      ]
                    })
                  ],
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: "999999" }
                  }
                }),

                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: "Unidade",
                          bold: true,
                          color: CORPORATE_GRAY,
                          font: "Calibri"
                        })
                      ]
                    })
                  ],
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: "999999" }
                  }
                }),

                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: "Quantidade",
                          bold: true,
                          color: CORPORATE_GRAY,
                          font: "Calibri"
                        })
                      ]
                    })
                  ],
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: "999999" }
                  }
                })
              ]
            }),
            ...grouped[category].map((item: any) =>
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: item.description,
                            font: "Calibri",
                            color: CORPORATE_GRAY
                          })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: item.dimension,
                            font: "Calibri",
                            color: CORPORATE_GRAY
                          })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: item.unit,
                            font: "Calibri",
                            color: CORPORATE_GRAY
                          })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: String(item.quantity),
                            font: "Calibri",
                            color: CORPORATE_GRAY
                          })
                        ]
                      })
                    ]
                  }),
                ],
              })
            ),
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
    children.unshift(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: `RM - ${project.name} - ${project.revision}`,
            bold: true,
            size: 28,
            color: CORPORATE_GRAY,
            font: "Calibri"
          })
        ]
      })
    );

    if (project.unification_mode === "global") {
      addCategoryGroup(data);
    } else if (data.pavimentos) {
      Object.entries(data.pavimentos).forEach(
        ([name, items]: [string, any]) => {
          children.push(
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { before: 200, after: 100 },
              children: [
                new TextRun({
                  text: `PAVIMENTO ${name.toUpperCase()}`,
                  bold: true,
                  size: 22,
                  color: CORPORATE_GRAY,
                  font: "Calibri"
                })
              ]
            })
          );

          children.push(new Paragraph(" "));
          addCategoryGroup(items);
        }
      );

      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 300, after: 120 },
          children: [
            new TextRun({
              text: "TOTAL GERAL CONSOLIDADO",
              bold: true,
              size: 24,
              color: CORPORATE_GRAY,
              font: "Calibri"
            })
          ]
        })
      );

      children.push(new Paragraph(" "));
      addCategoryGroup(data.total);
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,
                bottom: 720,
                left: 720,
                right: 720
              }
            }
          },
          children
        }
      ]
    });

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
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
} else {
  app.use(express.static("dist"));
  app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
}

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: err.message || "Erro interno no servidor." });
});

app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
