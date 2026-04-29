export const materialMap: Record<string, string> = {
  "Adaptador Soldável Curto com Bolsa e Rosca Para Registro":
    "Adaptador Soldável Curto com Bolsa e Rosca",

  "Bucha de Redução Longa, Esgoto SN - Tigre":
    "Bucha de Redução Longa",

  "Bucha de Redução Longa, Esgoto SR - Tigre":
    "Bucha de Redução Longa",

  "Caixa Sifonada Montada com Grelha e Porta Grelha Quadrados Brancos, Esgoto - Tigre":
    "Caixa Sifonada",

  "Caixa Sifonada Montada com Grelha e Porta Grelha Redondos Brancos, Esgoto - Tigre":
    "Caixa Sifonada",

  "Cap, Esgoto SN - Tigre":
    "Cap/tampão",

  "Curva 90º Curta, Esgoto SN - Tigre":
    "Curva 90º Curta",

  "Grelha Quadrada Comum - PEAD Branca":
    "Grelha Quadrada",

  "Joelho 45º - Esgoto SN - Tigre":
    "Joelho 45º",

  "Joelho 45º - Esgoto SR - Tigre":
    "Joelho 45º",

  "Joelho 90º - Esgoto SN - Tigre":
    "Joelho 90º",

  "Joelho 90º - Esgoto SR - Tigre":
    "Joelho 90º",

  "Junção Invertida, Esgoto SN - Tigre":
    "Junção Invertida",

  "Junção Simples, Esgoto SN - Tigre":
    "Junção Simples",

  "Junção Simples, Esgoto SR - Tigre":
    "Junção Simples",

  "Luva de Correr, Esgoto SN - Tigre":
    "Luva de Correr",

  "Luva Simples - Esgoto SN - Tigre":
    "Luva Simples",

  "Luva Simples - Esgoto SR - Tigre":
    "Luva Simples",

  "Porta Grelha Quadrado para Grelha Quadrada":
    "Porta Grelha Quadrado",

  "Redução Excêntrica, Esgoto SN - Tigre":
    "Redução Excêntrica",

  "Redução Excêntrica, Esgoto SR - Tigre":
    "Redução Excêntrica",

  "Tê , Esgoto SR - Tigre":
    "Tê 90º",

  "Tê, Esgoto SN - Tigre":
    "Tê 90º",

  "Bucha de Redução Soldável Longa, PVC Marrom, Água Fria - Tigre":
    "Bucha de Redução Soldável Longa",

  "Joelho 45º Soldável 20mm, PVC Marrom, Água Fria - TIGRE":
    "Joelho 45º Soldável",

  "Joelho 90º Soldável, PVC Marrom, Água Fria - Tigre":
    "Joelho 90º Soldável",

  "Tê Soldável, PVC Marrom, Água Fria - Tigre":
    "Tê Soldável",

  "Tubo PVC rígido, cor bege pérola, linha Esgoto SR - Tigre":
    "Tubo PVC rígido Série Reforçada - SR",

  "Tubo PVC rígido, cor branca, linha Esgoto SN - Tigre":
    "Tubo PVC rígido Série Normal - SN",

  "Tubo PVC rígido, cor marrom, linha soldável - Tigre":
    "Tubo PVC soldável marrom",

  // Mapeamento da planilha "antes e depois - Conexões - 24.04.csv"
  "Elemento Filtrante VRP Premium Ø2\"":
    "Elemento Filtrante VRP Premium",

  "Hidrômetro Ø1\"":
    "Hidrômetro",

  "Hidrômetro Ø3/4\"":
    "Hidrômetro",

  "Manômetro":
    "Manômetro",

  "Válvula de Esfera Ø1 1/2\"":
    "Registro Esfera",

  "Válvula de Esfera Ø1 1/4\"":
    "Registro Esfera",

  "Válvula de Esfera Ø1\"":
    "Registro Esfera",

  "Válvula de Esfera 1/2\"":
    "Registro Esfera",

  "Válvula de Esfera Ø2 1/2\"":
    "Registro Esfera",

  "Válvula de Esfera Ø2\"":
    "Registro Esfera",

  "Válvula de Esfera Ø3/4\"":
    "Registro Esfera",

  "Válvula de retenção horizontal Ø1 1/4\"":
    "Válvula de Retenção Horizontal",

  "Válvula de Retenção Vertical 1\"":
    "Válvula de Retenção Vertical",

  "Válvula Redutora de Pressão VRP Premium Ø1 1/2\"":
    "Válvula Redutora de Pressão VRP Premium",

  "Válvula Redutora de Pressão VRP Premium Ø1\"":
    "Válvula Redutora de Pressão VRP Premium",

  "Válvula Ventosa Ø1\"":
    "Ventosa",

  "Válvula Ventosa Ø3/4\"":
    "Ventosa",

  "Registro Esfera VS Soldável - Tigre":
    "Registro Esfera com União Soldável",

  "Corpo Caixa Seca, Esgoto - Tigre":
    "Ralo Seco",

  "Tubo PPR rígido, cor verde, classe de pressão PN 20 - Tigre":
    "Tubo PPR PN20",

  "Registro de Gaveta DocolBase - 3/4\" - Docol":
    "Registro de gaveta com canopla",

    "Registro de Gaveta DocolBase - 1\" - Docol":
    "Registro de gaveta com canopla",

  "Base Misturador Monocomando para Chuveiro 3/4, Bases - Docol":
    "Base Misturador Monocomando para Chuveiro"
};
export const ignoredMaterials = [
  "Lavatório com cuba retangular",
  "Pia com cuba retangular",
  "Tanque para lavar roupas",
  "Vaso sanitário",
  "Ducha com misturador paralelo",
  "Ducha com misturador de água fria",
  "Aparelho sanitário",
  "Louças",
  "Torneira",
  "Torneira de Jardim - Luxo Docol"
];

const normalizeInchFractions = (value: string) =>
  value
    .replace(/1\s*\.\s*1\/2/g, "1 1/2")
    .replace(/1\s+\s*1\/2/g, "1 1/2")
    .replace(/1\s+\s*1\/4/g, "1 1/4")
    .replace(/2\s+\s*1\/2/g, "2 1/2")
    .replace(/3\s+\s*1\/4/g, "3 1/4")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1/$2");

export const normalizeMaterialKey = (text: string) => {
  return normalizeInchFractions(
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[â€œâ€]/g, "\"")
      .replace(/''/g, "\"")
      .replace(/["]+/g, "\"")
      .replace(/Ã¸|Ã˜|âˆ…|phi|diam\.?/gi, "")
      .replace(/\bpolegadas?\b/gi, "\"")
      .replace(/[,\-–—]+/g, " ")
      .replace(/\s*mm\b/gi, " mm")
      .replace(/\s+/g, " ")
      .toLowerCase()
      .trim()
  );
};

const normalizedEntries = Object.entries(materialMap).map(([source, target]) => ({
  source,
  target,
  normalizedSource: normalizeMaterialKey(source)
}));

const normalizedIgnoredMaterials = ignoredMaterials.map(item =>
  normalizeMaterialKey(item)
);

export const mapMaterialName = (description: string) => {
  if (!description) return "";

  const original = description.trim();

  if (materialMap[original]) {
    return materialMap[original];
  }

  const normalizedOriginal = normalizeMaterialKey(original);

  const exactMatch = normalizedEntries.find(
    entry => entry.normalizedSource === normalizedOriginal
  );

  if (exactMatch) {
    return exactMatch.target;
  }

  const partialMatch = normalizedEntries.find(
    entry =>
      normalizedOriginal.includes(entry.normalizedSource) ||
      entry.normalizedSource.includes(normalizedOriginal)
  );

  if (partialMatch) {
    return partialMatch.target;
  }

  return original;
};

export const isIgnoredMaterial = (description: string) => {
  if (!description) return false;

  const normalizedDescription = normalizeMaterialKey(description);

  return normalizedIgnoredMaterials.some(
    ignored =>
      normalizedDescription === ignored ||
      normalizedDescription.includes(ignored) ||
      ignored.includes(normalizedDescription)
  );
};