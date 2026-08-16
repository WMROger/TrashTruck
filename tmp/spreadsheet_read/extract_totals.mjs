import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load("../../output/documents/Waste Management.xlsx"));
const specs = {
  "2021": ["B27:J27", "B56:J56"],
  "2022": ["B25:O26", "B52:O53"],
  "2023": ["B27:O28", "B57:O58"],
  "2024": ["B28:O29", "B58:O59"],
  "2025": ["B31:O32", "B73:O74"],
};
for (const [year, ranges] of Object.entries(specs)) {
  const ws = wb.worksheets.getItem(year);
  for (const range of ranges) console.log(year, range, JSON.stringify(ws.getRange(range).values));
}
for (const [year, range] of Object.entries({"2022":"A28:O33","2023":"A31:O39","2024":"A31:O38","2025":"A35:O46"})) {
  console.log("CONTEXT", year, range, JSON.stringify(wb.worksheets.getItem(year).getRange(range).values));
}
