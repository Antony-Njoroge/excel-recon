let data1 = [];
let data2 = [];

function reconcile() {
  const file1 = document.getElementById("file1").files[0];
  const file2 = document.getElementById("file2").files[0];
  const primaryField = document.getElementById("primaryField").value.trim();
  const secondaryField = document.getElementById("secondaryField").value.trim();

  if (!file1 || !file2 || !primaryField) {
    alert("Please select both files and enter a primary identifier.");
    return;
  }

  document.getElementById("progressBar").value = 10;

  // Parse file 1
  parseFile(file1, 1, () => {
    document.getElementById("progressBar").value = 40;
    parseFile(file2, 2, () => {
      document.getElementById("progressBar").value = 70;
      matchData(primaryField, secondaryField);
      document.getElementById("progressBar").value = 100;
    });
  });
}

function parseFile(file, id, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    let data;
    if (file.name.endsWith(".csv")) {
      const parsed = Papa.parse(e.target.result, { header: true });
      data = parsed.data;
    } else {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(sheet);
    }
    if (id === 1) data1 = data;
    else data2 = data;
    callback();
  };
  if (file.name.endsWith(".csv")) {
    reader.readAsText(file);
  } else {
    reader.readAsBinaryString(file);
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

  document.getElementById("progressBar").value = 80;

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
  const table = document.getElementById("resultTable");
  table.innerHTML = `
    <tr><th>Matched (${matched.length})</th></tr>
    ${matched.map(m => `<tr><td>${JSON.stringify(m)}</td></tr>`).join("")}
    <tr><th>Unmatched in File 1 (${unmatched1.length})</th></tr>
    ${unmatched1.map(u => `<tr><td>${JSON.stringify(u)}</td></tr>`).join("")}
    <tr><th>Unmatched in File 2 (${unmatched2.length})</th></tr>
    ${unmatched2.map(u => `<tr><td>${JSON.stringify(u)}</td></tr>`).join("")}
  `;
}

function downloadReport() {
  const wb = XLSX.utils.book_new();

  const matchedWS = XLSX.utils.json_to_sheet(
    document.querySelectorAll("#resultTable tr")[1]?.innerText.includes("Matched")
      ? JSON.parse(`[${Array.from(document.querySelectorAll("#resultTable tr"))
          .slice(1, 1 + parseInt(document.querySelectorAll("#resultTable tr")[1].innerText.split("(")[1]))]
          .map(r => r.children[0].innerText)
          .join(",")}]`)
      : []
  );
  XLSX.utils.book_append_sheet(wb, matchedWS, "Reconciled");

  const unmatched1WS = XLSX.utils.json_to_sheet(
    document.querySelectorAll("#resultTable tr")[1 + parseInt(document.querySelectorAll("#resultTable tr")[1].innerText.split("(")[1]) + 1]?.innerText.includes("Unmatched in File 1")
      ? JSON.parse(`[${Array.from(document.querySelectorAll("#resultTable tr"))
          .slice(1 + parseInt(document.querySelectorAll("#resultTable tr")[1].innerText.split("(")[1]) + 1,
                 1 + parseInt(document.querySelectorAll("#resultTable tr")[1].innerText.split("(")[1]) + 1 + parseInt(document.querySelectorAll("#resultTable tr")[1 + parseInt(document.querySelectorAll("#resultTable tr")[1].innerText.split("(")[1]) + 1].innerText.split("(")[1]))
          .map(r => r.children[0].innerText)
          .join(",")}]`)
      : []
  );
  XLSX.utils.book_append_sheet(wb, unmatched1WS, "Outstanding File 1");

  const unmatched2WS = XLSX.utils.json_to_sheet(
    document.querySelectorAll("#resultTable tr")[1 + parseInt(document.querySelectorAll("#resultTable tr")[1].innerText.split("(")[1]) + 1 + parseInt(document.querySelectorAll("#resultTable tr")[1 + parseInt(document.querySelectorAll("#resultTable tr")[1].innerText.split("(")[1]) + 1].innerText.split("(")[1]) + 1]?.innerText.includes("Unmatched in File 2")
      ? JSON.parse(`[${Array.from(document.querySelectorAll("#resultTable tr"))
          .slice(1 + parseInt(document.querySelectorAll("#resultTable tr")[1].innerText.split("(")[1]) + 1 + parseInt(document.querySelectorAll("#resultTable tr")[1 + parseInt(document.querySelectorAll("#resultTable tr")[1].innerText.split("(")[1]) + 1].innerText.split("(")[1]) + 1)
          .map(r => r.children[0].innerText)
          .join(",")}]`)
      : []
  );
  XLSX.utils.book_append_sheet(wb, unmatched2WS, "Outstanding File 2");

  XLSX.writeFile(wb, "Reconciliation_Report.xlsx");
}

function clearLogs() {
  document.getElementById("resultTable").innerHTML = "";
  document.getElementById("progressBar").value = 0;
}
