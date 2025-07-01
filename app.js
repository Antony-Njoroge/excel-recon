let data1 = [];
let data2 = [];

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

  // Reset UI
  const progressBar = document.getElementById("progressBar");
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "<p>Processing files, please wait...</p>";
  progressBar.value = 0;

  // Simulate progress updates
  progressBar.value = 10;

  setTimeout(() => {
    parseFile(file1, 1, () => {
      progressBar.value = 40;

      setTimeout(() => {
        parseFile(file2, 2, () => {
          progressBar.value = 70;

          setTimeout(() => {
            matchData(primaryField, secondaryField);
            progressBar.value = 100;
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
  }

  displayResults(matched, unmatched1, unmatched2);
}

function displayResults(matched, unmatched1, unmatched2) {
  const table = document.createElement("table");

  table.innerHTML = `
    <tr><th colspan="2">Matched (${matched.length})</th></tr>
    ${matched.map(m => `<tr><td>${JSON.stringify(m)}</td></tr>`).join("")}
    <tr><th colspan="2">Unmatched in File 1 (${unmatched1.length})</th></tr>
    ${unmatched1.map(u => `<tr><td>${JSON.stringify(u)}</td></tr>`).join("")}
    <tr><th colspan="2">Unmatched in File 2 (${unmatched2.length})</th></tr>
    ${unmatched2.map(u => `<tr><td>${JSON.stringify(u)}</td></tr>`).join("")}
  `;

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "<h2>Results</h2>";
  resultsDiv.appendChild(table);
  resultsDiv.insertAdjacentHTML("beforeend", `
    <button onclick="downloadReport()">Download Report</button>
    <button onclick="clearLogs()">Clear Logs</button>
  `);
}

function downloadReport() {
  const wb = XLSX.utils.book_new();

  const matchedWS = XLSX.utils.aoa_to_sheet([["Matched Items"]]);
  XLSX.utils.book_append_sheet(wb, matchedWS, "Reconciled");

  const unmatched1WS = XLSX.utils.aoa_to_sheet([["Outstanding in File 1"]]);
  XLSX.utils.book_append_sheet(wb, unmatched1WS, "Outstanding File 1");

  const unmatched2WS = XLSX.utils.aoa_to_sheet([["Outstanding in File 2"]]);
  XLSX.utils.book_append_sheet(wb, unmatched2WS, "Outstanding File 2");

  XLSX.writeFile(wb, "Reconciliation_Report.xlsx");
}

function clearLogs() {
  document.getElementById("results").innerHTML = "";
  document.getElementById("progressBar").value = 0;
}
