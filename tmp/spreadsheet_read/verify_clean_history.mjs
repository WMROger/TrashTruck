import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load("../../output/documents/TrashTrack_Clean_Historical_Data.xlsx"));
for(const [sheet,range] of [["Annual Summary","A4:O14"],["Monthly Summary","A4:J18"],["Data Quality","A4:E15"],["Plan Projections","A4:L14"]]){
  console.log(sheet,(await wb.inspect({kind:"table",sheetId:sheet,range,include:"values,formulas",tableMaxRows:20,tableMaxCols:16,maxChars:9000})).ndjson);
}
console.log("ERRORS",(await wb.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",options:{useRegex:true,maxResults:100},maxChars:2000})).ndjson);
