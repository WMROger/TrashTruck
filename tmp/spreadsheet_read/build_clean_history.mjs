import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const inputPath = "../../output/documents/Waste Management.xlsx";
const outputPath = "../../output/documents/TrashTrack_Clean_Historical_Data.xlsx";
const src = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const out = Workbook.create();

const months = {
  JANUARY: 1, FEBRUARY: 2, FEBRYARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, SEPTEBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};
const monthNames = [null,"January","February","March","April","May","June","July","August","September","October","November","December"];
const normalizeUnit = (x) => {
  const s = String(x ?? "").trim().toLowerCase();
  if (s.includes("ton")) return "metric_ton_as_reported";
  if (s.includes("cu.m") || s.includes("cubic")) return "cubic_meter";
  return "unspecified";
};
const cleanText = (x) => x == null ? "" : String(x).replace(/\s+/g," ").trim();
const numeric = (x) => typeof x === "number" && Number.isFinite(x);

const cleanRows = [];
const tripRows = [];
const sourceBlocks = [];
let rec = 1;

for (const year of [2021,2022,2023,2024,2025]) {
  const ws = src.worksheets.getItem(String(year));
  const used = ws.getUsedRange(true).values;
  const headerRows = [];
  for (let r=0; r<used.length; r++) {
    if (cleanText(used[r]?.[0]).toUpperCase()==="DRIVER" && cleanText(used[r]?.[1]).toUpperCase()==="ROUTE") headerRows.push(r);
  }
  for (let bi=0; bi<headerRows.length; bi++) {
    const hr = headerRows[bi];
    const block = `Block ${String.fromCharCode(65+bi)}`;
    const unitRow = used[hr+1] ?? [];
    const monthCols = [];
    for (let c=2; c<(used[hr]??[]).length; c++) {
      const key = cleanText(used[hr][c]).toUpperCase();
      if (months[key]) monthCols.push({ col:c, monthNo:months[key], month:monthNames[months[key]], sourceHeader:cleanText(used[hr][c]) });
    }
    const units = [...new Set(monthCols.map(m=>cleanText(unitRow[m.col])).filter(Boolean))];
    const sourceUnit = units.length===1 ? units[0] : (units.join(" / ") || "Unspecified");
    const normalizedUnit = normalizeUnit(sourceUnit);
    let totalRow = -1;
    for (let r=hr+2; r<used.length; r++) {
      if (cleanText(used[r]?.[1]).toUpperCase()==="TOTAL") { totalRow=r; break; }
    }
    if (totalRow<0) continue;
    const totalCol=(used[hr]??[]).findIndex(x=>cleanText(x).toUpperCase()==="TOTAL");
    const sourceReportedTotal=totalCol>=0 && numeric(used[totalRow]?.[totalCol]) ? used[totalRow][totalCol] : null;
    for (let r=hr+2; r<totalRow; r++) {
      const route = cleanText(used[r]?.[1]);
      const driver = cleanText(used[r]?.[0]);
      if (!route) continue;
      for (const m of monthCols) {
        const raw = used[r]?.[m.col];
        let status="Observed", flag="Block meaning unverified";
        let quantity=null;
        if (numeric(raw)) {
          quantity=raw;
          if (raw===0) { status="Reported zero"; flag += "; confirm true zero"; }
        } else if (cleanText(raw)==="-") {
          status="Missing - dash placeholder"; flag += "; missing observation";
        } else if (raw==null || cleanText(raw)==="") {
          status="Missing - blank"; flag += "; missing observation";
        } else {
          status="Non-numeric source value"; flag += `; source value: ${cleanText(raw)}`;
        }
        if (year===2021) flag += "; partial year (June-December only)";
        if (year===2025 && block==="Block A" && [11,12].includes(m.monthNo)) flag += "; 2025 Block A late-year value requires confirmation";
        if (year===2025 && block==="Block B" && [11,12].includes(m.monthNo)) flag += "; unusually high late-year total requires confirmation";
        cleanRows.push([
          `W${String(rec++).padStart(5,"0")}`,year,block,String(year),r+1,m.monthNo,m.month,
          new Date(Date.UTC(year,m.monthNo-1,1)),driver,route,quantity,sourceUnit,normalizedUnit,status,flag,
          "Waste Management.xlsx"
        ]);
      }
    }
    const truckRow = used[totalRow+1];
    let sourceReportedTripTotal=null;
    if (cleanText(truckRow?.[1]).toUpperCase()==="NO. OF TRUCKS") {
      if(totalCol>=0 && numeric(truckRow?.[totalCol])) sourceReportedTripTotal=truckRow[totalCol];
      for (const m of monthCols) {
        const raw=truckRow[m.col];
        let count=null, status="Observed";
        if (numeric(raw)) { count=raw; if(raw===0) status="Reported zero"; }
        else status=(raw==null||cleanText(raw)==="")?"Missing - blank":"Non-numeric source value";
        let flag="Source label says NO. OF TRUCKS; confirm whether values mean truck trips rather than unique vehicles.";
        if(year===2025 && block==="Block B" && [11,12].includes(m.monthNo)) flag += " Unusually high late-year count requires confirmation.";
        tripRows.push([year,block,String(year),totalRow+2,m.monthNo,m.month,new Date(Date.UTC(year,m.monthNo-1,1)),count,status,flag,"Waste Management.xlsx"]);
      }
    }
    sourceBlocks.push([year,block,hr+1,totalRow+1,monthCols.map(x=>x.month).join(", "),sourceUnit,normalizedUnit,sourceReportedTotal,sourceReportedTripTotal,"Meaning of repeated blocks is not identified in the source workbook; do not merge without CENRO confirmation."]);
  }
}

const colors = {navy:"#173B2C",green:"#2E6B4F",mint:"#E7F1EB",light:"#F4F7F5",gold:"#FFF1CC",red:"#FDE8E8",gray:"#5F6B65",white:"#FFFFFF",ink:"#17211C"};
function title(sheet, range, text, subtitle="") {
  sheet.getRange(range).merge(); sheet.getRange(range).values=[[text]];
  sheet.getRange(range).format={fill:colors.navy,font:{bold:true,color:colors.white,size:18},verticalAlignment:"center",rowHeight:32};
  if (subtitle) { const row=Number(range.match(/\d+/)[0])+1; const r=`A${row}:${range.split(":")[1].replace(/\d+/,row)}`; sheet.getRange(r).merge(); sheet.getRange(r).values=[[subtitle]]; sheet.getRange(r).format={fill:colors.mint,font:{color:colors.navy,size:10},wrapText:true,rowHeight:30}; }
}
function header(r){r.format={fill:colors.green,font:{bold:true,color:colors.white},wrapText:true,verticalAlignment:"center",rowHeight:30,borders:{preset:"outside",style:"thin",color:"#BCC9C1"}};}
function body(r){r.format={font:{color:colors.ink,size:9},verticalAlignment:"center",borders:{insideHorizontal:{style:"thin",color:"#E1E7E3"}},wrapText:false};}

// README
const readme=out.worksheets.add("README"); readme.showGridLines=false;
title(readme,"A1:H1","TrashTrack Clean Historical Dataset","Normalized from Waste Management.xlsx; original source preserved and not modified.");
readme.getRange("A4:B14").values=[
  ["Item","Guidance"],
  ["Purpose","Machine-readable historical waste-delivery data for descriptive analysis and baseline forecasting."],
  ["Source","Waste Management.xlsx (sheets 2021-2025) and 10 Year Solid Waste Management Plan.docx for projections."],
  ["Clean Data","One row per source route and month. Blank/dash values remain missing; zero remains a reported zero."],
  ["Truck Trips","Monthly values copied from rows labelled NO. OF TRUCKS. Confirm whether these are trips, loads, or unique vehicles."],
  ["Source Blocks","Repeated yearly tables are kept as Block A and Block B because the source does not identify their relationship."],
  ["Units","Units are preserved. Cubic meters and tons are not converted or added together."],
  ["Plan Projections","Official-plan projections are stored separately and must never be treated as observed history."],
  ["Model readiness","Use descriptive statistics and simple baselines first. Current monthly series is too small and inconsistent for a defensible LSTM."],
  ["Required confirmation","Ask CENRO to identify Block A/B, units, missing periods, 2025 late-year values, and the meaning of truck counts."],
  ["Recommended next input","Obtain weekly or daily weighbridge/delivery records, weather/holiday variables, route distance, fuel, and verified truck capacity."]
]; header(readme.getRange("A4:B4")); body(readme.getRange("A5:B14")); readme.getRange("A:A").format.columnWidth=23; readme.getRange("B:B").format.columnWidth=92; readme.getRange("B5:B14").format.wrapText=true; readme.getRange("A4:B14").format.autofitRows();

// Source blocks
const blocks=out.worksheets.add("Source Blocks"); blocks.showGridLines=false;
title(blocks,"A1:J1","Source Block Register","Every repeated source table is retained independently until its operational meaning is confirmed.");
const blockHeaders=["Year","Source Block","Header Row","Total Row","Months Present","Source Unit","Normalized Unit","Source Waste Total","Source Truck Total","Caution"];
blocks.getRange(`A4:J${4+sourceBlocks.length}`).values=[blockHeaders,...sourceBlocks]; header(blocks.getRange("A4:J4")); body(blocks.getRange(`A5:J${4+sourceBlocks.length}`));
blocks.tables.add(`A4:J${4+sourceBlocks.length}`,true,"SourceBlocksTable"); blocks.freezePanes.freezeRows(4);
[10,13,11,10,30,17,22,19,19,60].forEach((w,i)=>blocks.getRangeByIndexes(0,i,1,1).format.columnWidth=w); blocks.getRange(`E5:J${4+sourceBlocks.length}`).format.wrapText=true; blocks.getRange(`H5:I${4+sourceBlocks.length}`).format.numberFormat="#0.00"; blocks.getRange(`A4:J${4+sourceBlocks.length}`).format.autofitRows();

// Clean data
const clean=out.worksheets.add("Clean Data"); clean.showGridLines=false;
const cleanHeaders=["Record ID","Year","Source Block","Source Sheet","Source Row","Month No.","Month","Period","Driver","Route","Waste Quantity","Source Unit","Normalized Unit","Observation Status","Quality Flag","Source File"];
clean.getRange(`A1:P${1+cleanRows.length}`).values=[cleanHeaders,...cleanRows]; header(clean.getRange("A1:P1")); body(clean.getRange(`A2:P${1+cleanRows.length}`));
clean.tables.add(`A1:P${1+cleanRows.length}`,true,"CleanWasteData"); clean.freezePanes.freezeRows(1); clean.freezePanes.freezeColumns(8);
clean.getRange(`H2:H${1+cleanRows.length}`).format.numberFormat="yyyy-mm-dd"; clean.getRange(`K2:K${1+cleanRows.length}`).format.numberFormat="#0.00";
[12,8,13,12,10,10,12,13,22,60,15,15,22,25,55,24].forEach((w,i)=>clean.getRangeByIndexes(0,i,1,1).format.columnWidth=w);
clean.getRange(`I2:J${1+cleanRows.length}`).format.wrapText=true; clean.getRange(`N2:P${1+cleanRows.length}`).format.wrapText=true;
clean.getRange(`N2:N${1+cleanRows.length}`).conditionalFormats.add("containsText",{text:"Missing",format:{fill:colors.gold,font:{color:"#7A5A00"}}});
clean.getRange(`N2:N${1+cleanRows.length}`).conditionalFormats.add("containsText",{text:"Non-numeric",format:{fill:colors.red,font:{color:"#9B1C1C"}}});

// Truck trips
const trips=out.worksheets.add("Truck Trips"); trips.showGridLines=false;
const tripHeaders=["Year","Source Block","Source Sheet","Source Row","Month No.","Month","Period","Reported Truck Count","Observation Status","Quality Flag","Source File"];
trips.getRange(`A1:K${1+tripRows.length}`).values=[tripHeaders,...tripRows]; header(trips.getRange("A1:K1")); body(trips.getRange(`A2:K${1+tripRows.length}`));
trips.tables.add(`A1:K${1+tripRows.length}`,true,"TruckTripsTable"); trips.freezePanes.freezeRows(1); trips.getRange(`G2:G${1+tripRows.length}`).format.numberFormat="yyyy-mm-dd"; trips.getRange(`H2:H${1+tripRows.length}`).format.numberFormat="#0";
[9,13,12,10,10,12,13,20,22,60,24].forEach((w,i)=>trips.getRangeByIndexes(0,i,1,1).format.columnWidth=w); trips.getRange(`I2:J${1+tripRows.length}`).format.wrapText=true;

// Monthly summary formula-backed
const monthly=out.worksheets.add("Monthly Summary"); monthly.showGridLines=false;
title(monthly,"A1:J1","Monthly Summary","Formula-backed aggregation. Blocks and units remain separate.");
const summaryKeys=[];
for(const b of sourceBlocks){const [year,block,,,,sourceUnit,norm]=b; const present=String(b[4]).split(", "); for(const mn of present){summaryKeys.push([year,block,monthNames.indexOf(mn),mn,new Date(Date.UTC(year,monthNames.indexOf(mn)-1,1)),sourceUnit,norm]);}}
const mh=["Year","Source Block","Month No.","Month","Period","Source Unit","Normalized Unit","Waste Total","Reported Truck Count","Review Status"];
monthly.getRange(`A4:J${4+summaryKeys.length}`).values=[mh,...summaryKeys.map(x=>[...x,null,null,null])]; header(monthly.getRange("A4:J4")); body(monthly.getRange(`A5:J${4+summaryKeys.length}`));
const lastClean=1+cleanRows.length, lastTrips=1+tripRows.length, lastMonthly=4+summaryKeys.length;
for(let r=5;r<=lastMonthly;r++){
  monthly.getRange(`H${r}`).formulas=[[`=SUMIFS('Clean Data'!$K$2:$K$${lastClean},'Clean Data'!$B$2:$B$${lastClean},A${r},'Clean Data'!$C$2:$C$${lastClean},B${r},'Clean Data'!$F$2:$F$${lastClean},C${r})`]];
  monthly.getRange(`I${r}`).formulas=[[`=SUMIFS('Truck Trips'!$H$2:$H$${lastTrips},'Truck Trips'!$A$2:$A$${lastTrips},A${r},'Truck Trips'!$B$2:$B$${lastTrips},B${r},'Truck Trips'!$E$2:$E$${lastTrips},C${r})`]];
  monthly.getRange(`J${r}`).formulas=[[`=IF(COUNTIFS('Clean Data'!$B$2:$B$${lastClean},A${r},'Clean Data'!$C$2:$C$${lastClean},B${r},'Clean Data'!$F$2:$F$${lastClean},C${r},'Clean Data'!$N$2:$N$${lastClean},"Missing - blank")+COUNTIFS('Clean Data'!$B$2:$B$${lastClean},A${r},'Clean Data'!$C$2:$C$${lastClean},B${r},'Clean Data'!$F$2:$F$${lastClean},C${r},'Clean Data'!$N$2:$N$${lastClean},"Missing - dash placeholder")>0,"Review missing values","Source observations present")`]];
}
monthly.tables.add(`A4:J${lastMonthly}`,true,"MonthlySummaryTable"); monthly.freezePanes.freezeRows(4); monthly.getRange(`E5:E${lastMonthly}`).format.numberFormat="yyyy-mm-dd"; monthly.getRange(`H5:H${lastMonthly}`).format.numberFormat="#0.00"; monthly.getRange(`I5:I${lastMonthly}`).format.numberFormat="#0";
[9,13,10,12,13,15,22,15,21,27].forEach((w,i)=>monthly.getRangeByIndexes(0,i,1,1).format.columnWidth=w); monthly.getRange(`J5:J${lastMonthly}`).conditionalFormats.add("containsText",{text:"Review",format:{fill:colors.gold,font:{color:"#7A5A00"}}});

// Annual summary
const annual=out.worksheets.add("Annual Summary"); annual.showGridLines=false;
title(annual,"A1:O1","Annual Reconciliation Summary","Calculated detail totals are compared with source-reported totals; blocks and units remain separate.");
const annualKeys=sourceBlocks.map(b=>[b[0],b[1],b[5],b[6],null,null,null,null,null,b[7],null,null,b[8],null,"Review block definition and reconciliation"]);
const ah=["Year","Source Block","Source Unit","Normalized Unit","Records","Observed","Missing","Reported Zeros","Calculated Waste Total","Source Waste Total","Waste Difference","Calculated Truck Total","Source Truck Total","Truck Difference","Review Status"];
annual.getRange(`A4:O${4+annualKeys.length}`).values=[ah,...annualKeys]; header(annual.getRange("A4:O4")); body(annual.getRange(`A5:O${4+annualKeys.length}`));
const lastAnnual=4+annualKeys.length;
for(let r=5;r<=lastAnnual;r++){
  annual.getRange(`E${r}`).formulas=[[`=COUNTIFS('Clean Data'!$B$2:$B$${lastClean},A${r},'Clean Data'!$C$2:$C$${lastClean},B${r})`]];
  annual.getRange(`F${r}`).formulas=[[`=COUNTIFS('Clean Data'!$B$2:$B$${lastClean},A${r},'Clean Data'!$C$2:$C$${lastClean},B${r},'Clean Data'!$N$2:$N$${lastClean},"Observed")`]];
  annual.getRange(`G${r}`).formulas=[[`=COUNTIFS('Clean Data'!$B$2:$B$${lastClean},A${r},'Clean Data'!$C$2:$C$${lastClean},B${r},'Clean Data'!$N$2:$N$${lastClean},"Missing - blank")+COUNTIFS('Clean Data'!$B$2:$B$${lastClean},A${r},'Clean Data'!$C$2:$C$${lastClean},B${r},'Clean Data'!$N$2:$N$${lastClean},"Missing - dash placeholder")`]];
  annual.getRange(`H${r}`).formulas=[[`=COUNTIFS('Clean Data'!$B$2:$B$${lastClean},A${r},'Clean Data'!$C$2:$C$${lastClean},B${r},'Clean Data'!$N$2:$N$${lastClean},"Reported zero")`]];
  annual.getRange(`I${r}`).formulas=[[`=SUMIFS('Clean Data'!$K$2:$K$${lastClean},'Clean Data'!$B$2:$B$${lastClean},A${r},'Clean Data'!$C$2:$C$${lastClean},B${r})`]];
  annual.getRange(`K${r}`).formulas=[[`=I${r}-J${r}`]];
  annual.getRange(`L${r}`).formulas=[[`=SUMIFS('Truck Trips'!$H$2:$H$${lastTrips},'Truck Trips'!$A$2:$A$${lastTrips},A${r},'Truck Trips'!$B$2:$B$${lastTrips},B${r})`]];
  annual.getRange(`N${r}`).formulas=[[`=L${r}-M${r}`]];
}
annual.tables.add(`A4:O${lastAnnual}`,true,"AnnualSummaryTable"); annual.getRange(`E5:H${lastAnnual}`).format.numberFormat="#0"; annual.getRange(`I5:K${lastAnnual}`).format.numberFormat="#0.00"; annual.getRange(`L5:N${lastAnnual}`).format.numberFormat="#0";
[9,13,15,22,10,10,10,14,20,18,17,20,18,17,35].forEach((w,i)=>annual.getRangeByIndexes(0,i,1,1).format.columnWidth=w); annual.getRange(`O5:O${lastAnnual}`).format.wrapText=true; annual.getRange(`K5:K${lastAnnual}`).conditionalFormats.add("cellIs",{operator:"notEqual",formula:0,format:{fill:colors.gold,font:{color:"#7A5A00",bold:true}}}); annual.getRange(`N5:N${lastAnnual}`).conditionalFormats.add("cellIs",{operator:"notEqual",formula:0,format:{fill:colors.gold,font:{color:"#7A5A00",bold:true}}});

// Plan projections: isolated by design
const projectionRows=[
  [2018,0.278,147494,41003,67.74,27771,32.26,13332,12518,8385,6868,1139],
  [2019,0.278,152172,42303,74.66,31584,25.34,10719,15842,8650,7085,1760],
  [2020,0.278,157041,43657,76.47,33384,23.53,10273,17222,8927,7312,1213],
  [2021,0.278,162066,45054,85.89,38697,14.11,6357,21927,9213,7546,1252],
  [2022,0.278,167252,46496,88.89,41330,11.11,5166,22629,9508,9178,1292],
  [2023,0.278,172604,47983,88.89,42652,11.11,5331,23338,9812,9471,1333],
  [2024,0.278,178127,49519,88.89,44017,11.11,5502,24086,10126,9779,1376],
  [2025,0.278,183827,51103,88.89,45426,11.11,5677,24856,10450,10087,1420],
  [2026,0.278,189709,52739,88.89,46879,11.11,5860,25652,10785,10410,1466],
  [2027,0.278,195779,54426,88.89,48379,11.11,6047,26472,11135,10743,1513],
];
const proj=out.worksheets.add("Plan Projections"); proj.showGridLines=false;
title(proj,"A1:L1","10-Year Plan Projections - Not Observed Data","Copied from the official plan's waste quantity projection table; keep separate from the historical workbook.");
const ph=["Year","Waste kg/capita/day","Projected Population","Daily Waste Generation kg/day","Diversion Target %","Weight Diverted kg/day","Target Disposal %","Weight Disposed kg/day","Bio kg/day","Recyclables kg/day","Residual kg/day","Special kg/day"];
proj.getRange(`A4:L${4+projectionRows.length}`).values=[ph,...projectionRows]; header(proj.getRange("A4:L4")); body(proj.getRange(`A5:L${4+projectionRows.length}`)); proj.tables.add(`A4:L${4+projectionRows.length}`,true,"PlanProjectionTable");
proj.getRange(`B5:B${4+projectionRows.length}`).format.numberFormat="0.000"; proj.getRange(`C5:D${4+projectionRows.length}`).format.numberFormat="#,##0"; proj.getRange(`E5:E${4+projectionRows.length}`).format.numberFormat="0.00"; proj.getRange(`F5:F${4+projectionRows.length}`).format.numberFormat="#,##0"; proj.getRange(`G5:G${4+projectionRows.length}`).format.numberFormat="0.00"; proj.getRange(`H5:L${4+projectionRows.length}`).format.numberFormat="#,##0";
[9,20,20,25,18,23,18,23,14,19,16,15].forEach((w,i)=>proj.getRangeByIndexes(0,i,1,1).format.columnWidth=w); proj.getRange("A16:L17").merge(); proj.getRange("A16:L17").values=[["Source note: 10 Year Solid Waste Management Plan.docx, first extracted version of Table 5 / projection of waste quantity. These are planning projections based on a fixed 0.278 kg/person/day assumption, not measurements from Waste Management.xlsx. A later duplicate table contains several conflicting values and must be reconciled with the plan owner."]]; proj.getRange("A16:L17").format={fill:colors.gold,font:{color:"#7A5A00",italic:true},wrapText:true,verticalAlignment:"center"};

// Data quality register
const quality=out.worksheets.add("Data Quality"); quality.showGridLines=false;
title(quality,"A1:E1","Data Quality Register","Resolve these issues before model training or city-wide operational conclusions.");
const qrows=[
  ["Critical","Unknown repeated blocks","Every year contains two similar tables without a label that explains their difference.","Keep Block A/B separate; obtain written CENRO definition.","Open"],
  ["Critical","Mixed/inconsistent units","2021 Block B reports tons, while other blocks report cu.m.; later repeated blocks may be mislabeled.","Confirm measurement method and units; do not convert without density evidence.","Open"],
  ["High","Incomplete 2021 coverage","Only June-December is present.","Treat as partial-year data; obtain January-May records.","Open"],
  ["High","Missing values and dash placeholders","Blank and '-' cells occur in route-month observations.","Confirm whether missing, no collection, or zero; do not impute yet.","Open"],
  ["High","2025 late-year anomaly","Block A shows zero for November/December while Block B shows unusually high totals and truck counts.","Verify against source logs and correct only with documented evidence.","Open"],
  ["High","Detail totals do not always reconcile","2023 Block A differs from its source total by -38.32 cu.m.; 2023 Block B differs by -24.84 cu.m.","Check omitted/duplicated detail rows or incorrect source total formulas with CENRO.","Open"],
  ["High","Truck-count definition","Rows labelled NO. OF TRUCKS contain monthly values much larger than fleet size.","Relabel as trips/loads if confirmed; obtain data dictionary.","Open"],
  ["Medium","Driver blanks","Many barangay route rows have blank driver cells.","Do not forward-fill unless CENRO confirms grouping logic.","Open"],
  ["Medium","Route strings combine locations","Some routes include multiple barangays, streets, landmarks, and instructions.","Create a separate route-location mapping after operational validation.","Open"],
  ["Medium","Limited time-series size","At most five yearly sheets and monthly frequency, with gaps and structural breaks.","Use descriptive analysis and simple baselines; obtain weekly/daily data before LSTM.","Open"],
  ["Medium","Projections mixed with historical context","The 10-year plan contains projected 2018-2027 figures.","Keep projections in a separate sheet and label them clearly.","Resolved in this workbook"],
  ["High","Duplicate plan projections conflict","The plan repeats the projection table with differences, including 2018 and 2020 disposal values and the 2027 recyclable value.","Confirm the approved table version with the plan owner before citing or modeling projections.","Open"],
];
quality.getRange(`A4:E${4+qrows.length}`).values=[["Priority","Issue","Evidence","Required Resolution","Status"],...qrows]; header(quality.getRange("A4:E4")); body(quality.getRange(`A5:E${4+qrows.length}`)); quality.tables.add(`A4:E${4+qrows.length}`,true,"DataQualityTable");
[12,25,60,60,24].forEach((w,i)=>quality.getRangeByIndexes(0,i,1,1).format.columnWidth=w); quality.getRange(`B5:E${4+qrows.length}`).format.wrapText=true; quality.getRange(`A4:E${4+qrows.length}`).format.autofitRows();
quality.getRange(`A5:A${4+qrows.length}`).conditionalFormats.add("containsText",{text:"Critical",format:{fill:colors.red,font:{bold:true,color:"#9B1C1C"}}}); quality.getRange(`A5:A${4+qrows.length}`).conditionalFormats.add("containsText",{text:"High",format:{fill:colors.gold,font:{bold:true,color:"#7A5A00"}}});

// Model readiness
const ready=out.worksheets.add("Model Readiness"); ready.showGridLines=false;
title(ready,"A1:D1","Forecasting Readiness Assessment","The cleaned workbook supports baselines and data-quality work; it does not yet justify an LSTM claim.");
const rr=[
  ["Consistent target unit","Not ready","Mixed tons and cubic meters; blocks not defined","Confirm one target series and measurement unit"],
  ["Sufficient observations","Not ready","Monthly series has fewer than 60 periods, with 2021 partial","Obtain weekly/daily records for several years"],
  ["Complete periods","Not ready","Missing, dash, zero, and anomalous late-2025 values","Validate gaps before imputation"],
  ["Stable data-generating process","Unknown","Routes, trucks, reporting practice, and coverage may change by year","Document operational changes and structural breaks"],
  ["Train/validation/test design","Pending","No chronological evaluation split documented","Reserve newest period as untouched test set"],
  ["Baseline models","Pending","No seasonal-naive, moving-average, regression, ETS, or ARIMA benchmark","Build and compare transparent baselines first"],
  ["Explanatory variables","Limited","Routes and drivers exist, but distance, fuel, weather, holidays, capacity are absent","Collect relevant covariates"],
  ["Recommended current use","Ready","Descriptive totals, missingness review, route profiling, and baseline experiments","Proceed after CENRO definitions are confirmed"],
];
ready.getRange(`A4:D${4+rr.length}`).values=[["Criterion","Status","Finding","Next Action"],...rr]; header(ready.getRange("A4:D4")); body(ready.getRange(`A5:D${4+rr.length}`)); ready.tables.add(`A4:D${4+rr.length}`,true,"ModelReadinessTable");
[28,16,62,58].forEach((w,i)=>ready.getRangeByIndexes(0,i,1,1).format.columnWidth=w); ready.getRange(`A5:D${4+rr.length}`).format.wrapText=true; ready.getRange(`A4:D${4+rr.length}`).format.autofitRows(); ready.getRange(`B5:B${4+rr.length}`).conditionalFormats.add("containsText",{text:"Not ready",format:{fill:colors.red,font:{bold:true,color:"#9B1C1C"}}}); ready.getRange(`B5:B${4+rr.length}`).conditionalFormats.add("containsText",{text:"Ready",format:{fill:colors.mint,font:{bold:true,color:colors.green}}});

await fs.mkdir("../../output/documents",{recursive:true});
const blob=await SpreadsheetFile.exportXlsx(out); await blob.save(outputPath);

// Compact verification and previews
console.log((await out.inspect({kind:"workbook,sheet,table",maxChars:6000,tableMaxRows:5,tableMaxCols:8})).ndjson);
console.log("ERROR_SCAN",(await out.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",options:{useRegex:true,maxResults:100},maxChars:3000})).ndjson);
await fs.mkdir("renders_clean",{recursive:true});
const renderRanges={
  "README":"A1:H14","Source Blocks":"A1:J14","Clean Data":"A1:P45","Truck Trips":"A1:K45",
  "Monthly Summary":"A1:J55","Annual Summary":"A1:O14","Plan Projections":"A1:L17","Data Quality":"A1:E14","Model Readiness":"A1:D12"
};
for(const [name,range] of Object.entries(renderRanges)){
  const png=await out.render({sheetName:name,range,scale:0.8,format:"png"});
  await fs.writeFile(`renders_clean/${name.replace(/ /g,"_")}.png`,new Uint8Array(await png.arrayBuffer()));
}
console.log(JSON.stringify({outputPath,cleanRows:cleanRows.length,tripRows:tripRows.length,sourceBlocks:sourceBlocks.length,monthlyRows:summaryKeys.length}));
