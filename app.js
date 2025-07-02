let data1 = [];
let data2 = [];
let matchedDataGlobal = [];
let unmatched1Global = [];
let unmatched2Global = [];

function reconcile() {
  console.log("File 1:", file1.name);
  console.log("File 2:", file2.name);
  console.log("Primary Field:", primaryField);
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

  // Reset UI
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const resultsDiv = document.getElementById("results");

  progressBar.style.display = 'block';
  progressBar.value = 0;
  progressText.textContent = "Starting...";
  resultsDiv.innerHTML = ""; // Clear old results

  setTimeout(() => {
    progressText.textContent = "⏳ Loading first file...";
    progressBar.value = 10;

    parseFile(file1, 1, () => {
      console.log("Parsed File", id, "Data Sample:", data.slice(0, 2));
      progressText.textContent = "📄 Loaded first file. Loading second file...";
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

  // Build map for file 1
  for (const row of data1) {
    const key = row[primaryField];
    if (!map1[key]) map1[key] = [];
    map1[key].push(row);
  }

  // Match with file 2
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
  } // 👇 Add this before closing the function
  matchedDataGlobal = matched;
  unmatched1Global = unmatched1;
  unmatched2Global = unmatched2;

function displayResults(matched, unmatched1, unmatched2) {
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "<h2>Results</h2>";

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";

  function createRow(index, item, type = "") {
    const tr = document.createElement("tr");
    const tdIndex = document.createElement("td");
    tdIndex.textContent = index;
    tdIndex.style.fontWeight = "bold";
    tdIndex.style.background = "#f0f0f0";
    tdIndex.style.width = "50px";

    const tdItem = document.createElement("td");
    tdItem.textContent = JSON.stringify(item);
    if (type === "unmatched") {
      tdItem.style.backgroundColor = "#ffe6e6"; // Light red
    }

    tr.appendChild(tdIndex);
    tr.appendChild(tdItem);
    return tr;
  }

  // Matched Items
  const matchedHeader = document.createElement("tr");
  const mh = document.createElement("th");
  mh.colSpan = 2;
  mh.textContent = `Matched (${matched.length})`;
  mh.style.background = "#d4f4dd";
  mh.style.textAlign = "left";
  matchedHeader.appendChild(mh);
  table.appendChild(matchedHeader);

  matched.forEach((item, i) => table.appendChild(createRow(i + 1, item)));

  // Unmatched File 1
  const unmatched1Header = document.createElement("tr");
  const uh1 = document.createElement("th");
  uh1.colSpan = 2;
  uh1.textContent = `Unmatched in File 1 (${unmatched1.length})`;
  uh1.style.background = "#f8d7da";
  uh1.style.textAlign = "left";
  unmatched1Header.appendChild(uh1);
  table.appendChild(unmatched1Header);

  unmatched1.forEach((item, i) => table.appendChild(createRow(i + 1, item, "unmatched")));

  // Unmatched File 2
  const unmatched2Header = document.createElement("tr");
  const uh2 = document.createElement("th");
  uh2.colSpan = 2;
  uh2.textContent = `Unmatched in File 2 (${unmatched2.length})`;
  uh2.style.background = "#f8d7da";
  uh2.style.textAlign = "left";
  unmatched2Header.appendChild(uh2);
  table.appendChild(unmatched2Header);

  unmatched2.forEach((item, i) => table.appendChild(createRow(i + 1, item, "unmatched")));

  resultsDiv.appendChild(table);

  // Buttons
  resultsDiv.insertAdjacentHTML("beforeend", `
    <label for="downloadFormat">Download Format:</label>
    <select id="downloadFormat">
      <option value="xlsx">Excel (.xlsx)</option>
      <option value="csv">CSV (.csv)</option>
    </select>
    <button onclick="downloadReport()">Download Report</button>
    <button onclick="clearLogs()">Clear Logs</button>
  `);
}

function downloadReport() {
  const format = document.getElementById("downloadFormat").value;

  const wb = XLSX.utils.book_new();

  function exportSheet(data, sheetName) {
    if (data.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([[`No data available for ${sheetName}`]]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      return;
    }

    if (format === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    } else if (format === "csv") {
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `${sheetName}.csv`);
    }
  }

  exportSheet(matchedDataGlobal, "Reconciled");
  exportSheet(unmatched1Global, "Outstanding File 1");
  exportSheet(unmatched2Global, "Outstanding File 2");

  if (format === "xlsx") {
    XLSX.writeFile(wb, "Reconciliation_Report.xlsx");
  }

  clearLogs(); // Auto-clear logs after download
}
