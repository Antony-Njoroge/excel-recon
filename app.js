let data1 = [];
let data2 = [];
let matchedDataGlobal = [];
let unmatched1Global = [];
let unmatched2Global = [];

function reconcile() {
  const fileInput1 = document.getElementById("file1");
  const fileInput2 = document.getElementById("file2");
  const primaryField = document.getElementById("primaryField").value.trim();
  const secondaryField = document.getElementById("secondaryField").value.trim();

  const file1 = fileInput1.files[0];
  const file2 = fileInput2.files[0];

  if (!file1 || !file2 || !primaryField) {
    alert("Please select both files and enter a primary identifier.");
    return;
  }

  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const resultsDiv = document.getElementById("results");

  progressBar.style.display = 'block';
  progressBar.value = 0;
  progressText.textContent = "Starting...";
  resultsDiv.innerHTML = "";

  setTimeout(() => {
    progressText.textContent = "⏳ Loading first file...";
    progressBar.value = 10;

    parseFile(file1, 1, () => {
      progressText.textContent = "📄 Loaded File 1. Loading File 2...";
      progressBar.value = 40;

      setTimeout(() => {
        parseFile(file2, 2, () => {
          progressText.textContent = "🔍 Matching data...";
          progressBar.value = 70;

          setTimeout(() => {
            matchData(primaryField, secondaryField);
            progressBar.value = 100;
            progressText.textContent = "✅ Matching complete!";
            displayResults(matchedDataGlobal, unmatched1Global, unmatched2Global);
          }, 200);
        });
      }, 200);
    });
  }, 200);
}

function parseFile(file, id, callback) {
  const reader = new FileReader();

  reader.onload = function (e) {
    let parsedData;

    if (file.name.endsWith(".csv")) {
      Papa.parse(e.target.result, {
        header: true,
        complete: function (results) {
          parsedData = results.data;
          if (id === 1) data1 = parsedData;
          else data2 = parsedData;
          callback();
        }
      });
    } else {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      parsedData = XLSX.utils.sheet_to_json(sheet);
      if (id === 1) data1 = parsedData;
      else data2 = parsedData;
      callback();
    }
  };

  if (file.name.endsWith(".csv")) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
}

function matchData(primaryField, secondaryField) {
  const map1 = {};
  const matched = [];
  const unmatched1 = [];
  const unmatched2 = [];

  for (const row of data1) {
    const key = row[primaryField];
    if (!map1[key]) map1[key] = [];
    map1[key].push(row);
  }

  for (const row of data2) {
    const key = row[primaryField];
    if (map1[key]) {
      if (secondaryField && row[secondaryField]) {
        const match = map1[key].find(r => r[secondaryField] === row[secondaryField]);
        if (match) {
          matched.push({ ...row, MatchedTo: JSON.stringify(match) });
          map1[key] = map1[key].filter(r => r !== match);
        } else {
          unmatched2.push(row);
        }
      } else {
        matched.push({ ...row, MatchedTo: JSON.stringify(map1[key][0]) });
        map1[key].shift();
      }
    } else {
      unmatched2.push(row);
    }
  }

  for (const key in map1) {
    unmatched1.push(...map1[key]);
  }

  matchedDataGlobal = matched;
  unmatched1Global = unmatched1;
  unmatched2Global = unmatched2;
}

function displayResults(matched, unmatched1, unmatched2) {
  const resultsDiv = document.getElementById("results");

  resultsDiv.innerHTML += `
    <h3>Matched (${matched.length})</h3>
    <ul>${matched.map(m => `<li>${JSON.stringify(m)}</li>`).join("")}</ul>

    <h3>Unmatched in File 1 (${unmatched1.length})</h3>
    <ul>${unmatched1.map(u => `<li>${JSON.stringify(u)}</li>`).join("")}</ul>

    <h3>Unmatched in File 2 (${unmatched2.length})</h3>
    <ul>${unmatched2.map(u => `<li>${JSON.stringify(u)}</li>`).join("")}</ul>

    <label for="downloadFormat">Download Format:</label>
    <select id="downloadFormat">
      <option value="xlsx">Excel (.xlsx)</option>
      <option value="csv">CSV (.csv)</option>
    </select>
    <button onclick="downloadReport()">Download Report</button>
    <button onclick="clearLogs()">Clear Logs</button>
  `;
}
function downloadReport() {
  const format = document.getElementById("downloadFormat").value;
  const { file1Name, file2Name } = uploadedFileNames;

  // Validate data
  if (!matchedDataGlobal || !unmatched1Global || !unmatched2Global) {
    alert("No data available. Please reconcile files first.");
    return;
  }

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();

    function addSheet(data, sheetName, colorHex = "#FFFFFF") {
      let ws;
      if (!data || data.length === 0) {
        ws = XLSX.utils.aoa_to_sheet([[`No data available for ${sheetName}`]]);
      } else {
        ws = XLSX.utils.json_to_sheet(data);
      }

      // Apply tab color
      if (wb.Sheets[sheetName]) delete wb.Sheets[sheetName]; // Avoid duplicates
      wb.SheetNames.push(sheetName);
      ws['!cols'] = [{ wch: 20 }, { wch: 30 }];

      // Set tab color
      wb.Sheets[sheetName] = ws;
      if (!wb.Workbook) wb.Workbook = { Sheets: [] };
      wb.Workbook.Sheets.push({
        name: sheetName,
        color: `#${colorHex}`, // Set tab color
        hidden: false
      });
    }

    // Add sheets
    addSheet(matchedDataGlobal, `Reconciled`, "C8E6C9"); // Light green
    addSheet(unmatched1Global, `Outstanding File 1 - ${file1Name}`, "FFCDD2"); // Light red
    addSheet(unmatched2Global, `Outstanding File 2 - ${file2Name}`, "FFCDD2"); // Light red

    // Trigger download
    XLSX.writeFile(wb, `Reconciliation_Report_${new Date().toISOString().slice(0,10)}.xlsx`);

  } else if (format === "csv") {
    const zip = new JSZip();
    const csvFolder = zip.folder("Reconciliation_CSV");

    function addCSV(data, filename) {
      if (!data || data.length === 0) {
        csvFolder.file(`${filename}.csv`, `No data available`);
        return;
      }
      const csv = Papa.unparse(data);
      csvFolder.file(`${filename}.csv`, csv);
    }

    addCSV(matchedDataGlobal, `Reconciled_Items`);
    addCSV(unmatched1Global, `Outstanding_File1_${file1Name}`);
    addCSV(unmatched2Global, `Outstanding_File2_${file2Name}`);

    zip.generateAsync({ type: "blob" }).then(function (content) {
      saveAs(content, "Reconciliation_Report_CSV.zip");
    });
  }

  clearLogs(); // Optional: Clear logs after download
}

function clearLogs() {
  document.getElementById("results").innerHTML = "";
  document.getElementById("progressBar").value = 0;
  document.getElementById("progressText").textContent = "";
}
