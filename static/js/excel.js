// Excel Editor JavaScript
let spreadsheetData = [];
const ROWS = 20;
const COLS = 10;

document.addEventListener('DOMContentLoaded', () => {
    initializeSpreadsheet();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('excelUpload').addEventListener('change', handleExcelUpload);
    document.getElementById('newSheetBtn').addEventListener('click', createNewSheet);
    document.getElementById('saveBtn').addEventListener('click', saveSpreadsheet);
    document.getElementById('exportExcelBtn').addEventListener('click', () => exportSpreadsheet('xlsx'));
    document.getElementById('exportPdfBtn').addEventListener('click', () => exportSpreadsheet('pdf'));
}

function initializeSpreadsheet() {
    spreadsheetData = Array(ROWS).fill(null).map(() => Array(COLS).fill(''));
    renderSpreadsheet();
}

function renderSpreadsheet() {
    const headerRow = document.getElementById('headerRow');
    const tbody = document.getElementById('spreadsheetBody');

    // Clear existing
    headerRow.innerHTML = '<th></th>';
    tbody.innerHTML = '';

    // Create headers (A, B, C, ...)
    for (let col = 0; col < COLS; col++) {
        const th = document.createElement('th');
        th.textContent = String.fromCharCode(65 + col);
        headerRow.appendChild(th);
    }

    // Create rows
    for (let row = 0; row < ROWS; row++) {
        const tr = document.createElement('tr');

        // Row number
        const rowHeader = document.createElement('td');
        rowHeader.className = 'row-header';
        rowHeader.textContent = row + 1;
        tr.appendChild(rowHeader);

        // Cells
        for (let col = 0; col < COLS; col++) {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.value = spreadsheetData[row][col] || '';
            input.dataset.row = row;
            input.dataset.col = col;
            input.addEventListener('input', handleCellEdit);
            td.appendChild(input);
            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    }
}

function handleCellEdit(e) {
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    // Ensure row exists in spreadsheetData
    if (!spreadsheetData[row]) {
        spreadsheetData[row] = [];
    }
    spreadsheetData[row][col] = e.target.value;
}

function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            // Use SheetJS to parse Excel
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Get first sheet
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            // Update spreadsheet data
            spreadsheetData = jsonData;

            // Ensure we have enough rows/cols
            const maxCols = Math.max(...jsonData.map(row => row.length), COLS);
            const maxRows = Math.max(jsonData.length, ROWS);

            // Pad data
            while (spreadsheetData.length < maxRows) {
                spreadsheetData.push([]);
            }
            spreadsheetData.forEach(row => {
                while (row.length < maxCols) {
                    row.push('');
                }
            });

            renderSpreadsheet();
            alert(`Excel file loaded: ${jsonData.length} rows, ${maxCols} columns`);
        } catch (error) {
            console.error('Excel parse error:', error);
            alert('Failed to parse Excel file. Please try a different file.');
        }
    };
    reader.readAsArrayBuffer(file);
}

function createNewSheet() {
    if (confirm('Create new empty spreadsheet? Current data will be lost.')) {
        initializeSpreadsheet();
    }
}

async function saveSpreadsheet() {
    const title = prompt('Enter spreadsheet title:', 'My Spreadsheet');
    if (!title) return;

    try {
        const response = await fetch('/api/excel/save/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                title: title,
                data: spreadsheetData
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                alert('Spreadsheet saved successfully!');
            } else {
                // File download
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${title}.xlsx`;
                a.click();
            }
        } else {
            alert('Failed to save spreadsheet');
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('Failed to save spreadsheet');
    }
}

async function exportSpreadsheet(format) {
    const title = prompt('Enter file name:', 'export');
    if (!title) return;

    try {
        const response = await fetch('/api/excel/export/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                title: title,
                data: spreadsheetData,
                format: format
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title}.${format}`;
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            alert('Export failed');
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('Export failed');
    }
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
