import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const file = await FileBlob.load("../../output/documents/Waste Management.xlsx");
const wb = await SpreadsheetFile.importXlsx(file);
const overview = await wb.inspect({
  kind: "workbook,sheet,table,region",
  include: "id,name,values,formulas",
  maxChars: 24000,
  tableMaxRows: 30,
  tableMaxCols: 16,
  tableMaxCellChars: 120,
});
console.log(overview.ndjson);

const sheets = await wb.inspect({ kind: "sheet", include: "id,name", maxChars: 4000 });
console.log("SHEETS\n" + sheets.ndjson);

for (const year of ["2021", "2022", "2023", "2024", "2025"]) {
  const totals = await wb.inspect({
    kind: "match",
    sheetId: year,
    searchTerm: "TOTAL|NO. OF TRUCKS|TONS|cu.m.",
    options: { useRegex: true, maxResults: 50 },
    maxChars: 8000,
  });
  console.log(`MATCHES ${year}\n${totals.ndjson}`);
}

await fs.mkdir("renders", { recursive: true });
const sheetLines = sheets.ndjson.split("\n").filter(Boolean);
for (const line of sheetLines) {
  try {
    const rec = JSON.parse(line);
    const name = rec.name ?? rec.sheetName;
    if (!name) continue;
    const preview = await wb.render({ sheetName: name, autoCrop: "all", scale: 1, format: "png" });
    const safe = name.replace(/[^a-z0-9_-]+/gi, "_");
    await fs.writeFile(`renders/${safe}.png`, new Uint8Array(await preview.arrayBuffer()));
  } catch {}
}
