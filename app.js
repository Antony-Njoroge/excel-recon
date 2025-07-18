let data1 = [];
let data2 = [];
let matchedDataGlobal = [];
let unmatched1Global = [];
let unmatched2Global = [];

let uploadedFileNames = {
  file1Name: "",
  file2Name: ""
};

// Normalize phone numbers by extracting last 9 digits
function normalizePhoneNumber(phone) {
  if (!phone) return "";
  const str = String(phone).replace(/\D/g, '');
  return str.slice(-9); // Last 9 digits
}

// Reconcile function
function reconcile() {
  const fileInput1 = document.getElementById("file1");
  const fileInput2 = document.getElementById("file2");
  const primaryField = document.getElementById("primaryField").value.trim();
  const secondaryField = document.getElementById("secondaryField").value.trim();

  const file1 = fileInput1.files[0];
  const file2 = fileInput2.files[0];

  if (!file1 || !file2 || !primaryField) {
    alert("Please upload both files and enter a primary identifier.");
    return;
  }

  uploadedFileNames.file1Name = file1.name;
  uploadedFileNames.file2Name = file2.name;

  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const resultsDiv = document.getElementById("results");

  progressBar.style.display = "block";
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

// Parse CSV or Excel
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

/**
 * Performs exact match reconciliation using primary identifier
 * Optionally uses secondary field for accuracy
 */
function matchData(primaryField, secondaryField = "") {
  const map1 = {};
  const matched = [];
  const unmatched1 = [];
  const unmatched2 = [];

  // Build map from File 1 by exact primary identifier
  for (const row of data1) {
    const key = row[primaryField];

    // Skip if empty/null/N/A
    if (!key || String(key).trim().toLowerCase() === "n/a" || String(key).trim() === "") {
      continue;
    }

    if (!map1[key]) map1[key] = [];
    map1[key].push(row);
  }

  // Match against File 2
  for (const row of data2) {
    const key = row[primaryField];

    // Skip if empty/null/N/A
    if (!key || String(key).trim() === "" || String(key).toLowerCase() === "n/a") {
      unmatched2.push(row);
      continue;
    }

    const candidates = map1[key];

    if (!candidates || candidates.length === 0) {
      unmatched2.push(row);
      continue;
    }

    let match;

    // Use secondary field if provided
    if (secondaryField && row[secondaryField]) {
      const targetValue = row[secondaryField];
      match = candidates.find(r => r[secondaryField] === targetValue);
    } else {
      match = candidates[0]; // Fallback: First available match
    }

    if (match) {
      // Include all original fields + add MatchedTo info
      matched.push({
        ...row,
        MatchedTo: JSON.stringify(match)
      });

      // Remove matched item from pool
      map1[key] = candidates.filter(r => r !== match);
    } else {
      unmatched2.push(row); // No match found
    }
  }

  // Remaining in File 1 are unmatched
  for (const key in map1) {
    unmatched1.push(...map1[key]);
  }

  // Save globally for preview/download
  matchedDataGlobal = matched;
  unmatched1Global = unmatched1;
  unmatched2Global = unmatched2;
}
// Display preview of top 5 items
function displayResults(matched, unmatched1, unmatched2) {
  const resultsDiv = document.getElementById("results");

  function createTable(data, title, limit = 5, headerColor = "#d4f4dd") {
    const limitedData = data.slice(0, limit);
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";

    const headerRow = document.createElement("tr");
    const headerCell = document.createElement("th");
    headerCell.colSpan = 2;
    headerCell.textContent = `${title} (${data.length})`;
    headerCell.style.background = headerColor;
    headerCell.style.textAlign = "left";
    headerCell.style.padding = "10px";
    headerRow.appendChild(headerCell);
    table.appendChild(headerRow);

    limitedData.forEach((item, index) => {
      const tr = document.createElement("tr");

      const tdIndex = document.createElement("td");
      tdIndex.textContent = index + 1;
      tdIndex.style.fontWeight = "bold";
      tdIndex.style.background = "#f0f0f0";
      tdIndex.style.width = "50px";

      const tdItem = document.createElement("td");
      tdItem.textContent = JSON.stringify(item);

      tr.appendChild(tdIndex);
      tr.appendChild(tdItem);
      table.appendChild(tr);
    });

    return table;
  }

  resultsDiv.innerHTML = "<h3>Preview (Top 5 Items)</h3>";

  resultsDiv.appendChild(createTable(matched, "Reconciled", 5, "#c8e6c9"));
  resultsDiv.appendChild(createTable(unmatched1, "Outstanding in File 1", 5, "#ffcdd2"));
  resultsDiv.appendChild(createTable(unmatched2, "Outstanding in File 2", 5, "#ffcdd2"));

  resultsDiv.insertAdjacentHTML("beforeend", `
    <label for="downloadFormat">Download Format:</label>
    <select id="downloadFormat">
      <option value="xlsx">Excel (.xlsx)</option>
      <option value="csv">CSV (.zip)</option>
    </select>
    <button onclick="downloadReport()">Download Report</button>
    <button onclick="clearLogs()">Clear Logs</button>
  `);
}

// Download report
function downloadReport() {
  const format = document.getElementById("downloadFormat").value;

  if (!matchedDataGlobal || !unmatched1Global || !unmatched2Global) {
    alert("No data available to export.");
    return;
  }

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();

    function addSheet(data, sheetName, colorHex = "FFFFFF") {
      if (!data || data.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([[`No data available for ${sheetName}`]]);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        return;
      }

      // Convert all values to strings to prevent scientific notation and date issues
      const stringifiedData = data.map(row => {
        const newRow = {};
        for (let key in row) {
          let value = row[key];

          // Keep empty values
          if (value === null || value === undefined) {
            newRow[key] = "";
          }
          // Preserve number-like fields as strings
          else if (typeof value === 'number') {
            newRow[key] = String(value);
          }
          // Preserve string fields as-is
          else if (typeof value === 'string') {
            newRow[key] = value.trim();
          }
          else {
            newRow[key] = value;
          }
        }
        return newRow;
      });

      const ws = XLSX.utils.json_to_sheet(stringifiedData);

      // Set column widths
      ws['!cols'] = Object.keys(stringifiedData[0]).map(() => ({ wch: 20 }));

      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Apply tab color
      if (!wb.Workbook) wb.Workbook = { Sheets: [] };
      wb.Workbook.Sheets.push({
        name: sheetName,
        color: `#${colorHex}`,
        hidden: false
      });
    }

    addSheet(matchedDataGlobal, "Reconciled", "C8E6C9"); // Green
    addSheet(unmatched1Global, `Outstanding File 1`, "FFCDD2"); // Red
    addSheet(unmatched2Global, `Outstanding File 2`, "FFCDD2"); // Red

    try {
      XLSX.writeFile(wb, "Reconciliation_Report.xlsx");
    } catch (e) {
      console.error("Failed to generate Excel file:", e);
      alert("Error generating Excel file. See console for details.");
    }

  } else if (format === "csv") {
    const zip = new JSZip();
    const csvFolder = zip.folder("Reconciliation_CSV");

    function addCSV(data, filename) {
      if (!data || data.length === 0) {
        csvFolder.file(`${filename}.csv`, "No data available");
        return;
      }
      const csv = Papa.unparse(data);
      csvFolder.file(`${filename}.csv`, csv);
    }

    addCSV(matchedDataGlobal, "Reconciled_Items");
    addCSV(unmatched1Global, `Outstanding_File1_${uploadedFileNames.file1Name}`);
    addCSV(unmatched2Global, `Outstanding_File2_${uploadedFileNames.file2Name}`);

    zip.generateAsync({ type: "blob" }).then(function (content) {
      saveAs(content, "Reconciliation_Report_CSV.zip");
    });
  }

  clearLogs(); // Optional: Clear logs after download
}
