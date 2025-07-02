let data1 = [];
let data2 = [];
let matchedDataGlobal = [];
let unmatched1Global = [];
let unmatched2Global = [];

let uploadedFileNames = {
  file1Name: "",
  file2Name: ""
};

function reconcile() {
  const fileInput1 = document.getElementById("file1");
  const fileInput2 = document.getElementById("file2");
  const primaryField = document.getElementById("primaryField").value.trim();
  const secondaryField = document.getElementById("secondaryField").value.trim();

const file1 = fileInput1.files[0];
const file2 = fileInput2.files[0];

uploadedFileNames.file1Name = file1.name;
uploadedFileNames.file2Name = file2.name;

  if (!file1 || !file2 || !primaryField) {
    alert("Please select both files and enter a primary identifier.");
    return;
  }

  // Save file names globally
  window.uploadedFileNames = {
    file1Name: file1.name,
    file2Name: file2.name
  };

  // ... rest of function remains unchanged ...

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

  // Clear previous content
  resultsDiv.innerHTML = "<h2>Results</h2>";

  // Helper to create a styled table
  function createTable(data, title, limit = 5, headerColor = "#d4f4dd") {
    const limitedData = data.slice(0, limit);
    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.style.marginBottom = "20px";

    // Header row
    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    const th = document.createElement("th");
    th.colSpan = 2;
    th.textContent = `${title} (${data.length})`;
    th.style.background = headerColor;
    th.style.textAlign = "left";
    th.style.padding = "10px";
    trHead.appendChild(th);
    thead.appendChild(trHead);
    table.appendChild(thead);

    // Body rows
    const tbody = document.createElement("tbody");
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
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
  }

  // Reconciled Items (Green Header)
  const matchedTable = createTable(matched, "Reconciled", 5, "#c8e6c9");
  resultsDiv.appendChild(matchedTable);

  // Unmatched File 1 (Red Header)
  const unmatched1Table = createTable(unmatched1, "Outstanding in File 1", 5, "#ffcdd2");
  resultsDiv.appendChild(unmatched1Table);

  // Unmatched File 2 (Red Header)
  const unmatched2Table = createTable(unmatched2, "Outstanding in File 2", 5, "#ffcdd2");
  resultsDiv.appendChild(unmatched2Table);

  // Buttons
  resultsDiv.insertAdjacentHTML("beforeend", `
    <label for="downloadFormat">Download Format:</label>
    <select id="downloadFormat">
      <option value="xlsx">Excel (.xlsx)</option>
      <option value="csv">CSV (.csv)</option>
    </select>
    <button onclick="downloadReport()">Download Full Report</button>
    <button onclick="clearLogs()">Clear Logs & Uploads</button>
  `);
}
function downloadReport() {
  const format = document.getElementById("downloadFormat").value;
  const { file1Name, file2Name } = uploadedFileNames;

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();

    // Helper to add data to worksheet
    function addSheet(data, sheetName, color) {
      if (!data || data.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([[`No data available for ${sheetName}`]]);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);

      // Apply header style
      if (ws['A1']) {
        ws['A1'].s = {
          fill: { fgColor: { rgb: color.replace("#", "") + "FF" } }
        };
      }

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // Add each dataset as a new sheet
    addSheet(matchedDataGlobal, `Reconciled - ${file1Name} & ${file2Name}`, "C8E6C9"); // Green
    addSheet(unmatched1Global, `Outstanding File 1 - ${file1Name}`, "FFCDD2");         // Red
    addSheet(unmatched2Global, `Outstanding File 2 - ${file2Name}`, "FFCDD2");         // Red

    // Trigger Excel file download
    XLSX.writeFile(wb, `Reconciliation_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  } else if (format === "csv") {
    // Create ZIP with all CSVs
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

    addCSV(matchedDataGlobal, `Reconciled-${file1Name}-${file2Name}`);
    addCSV(unmatched1Global, `Outstanding-File1-${file1Name}`);
    addCSV(unmatched2Global, `Outstanding-File2-${file2Name}`);

    zip.generateAsync({ type: "blob" }).then(function (content) {
      saveAs(content, "Reconciliation_Report_CSV.zip");
    });
  }

  clearLogs();
}
function clearLogs() {
  document.getElementById("results").innerHTML = "";
  document.getElementById("progressBar").value = 0;
  document.getElementById("progressText").textContent = "";

  // Reset file inputs
  document.getElementById("file1").value = "";
  document.getElementById("file2").value = "";

  // Reset global arrays
  data1 = [];
  data2 = [];
  matchedDataGlobal = [];
  unmatched1Global = [];
  unmatched2Global = [];
}
