function showSection(sectionId) {
  const sections = document.querySelectorAll('.tool-section');
  sections.forEach(sec => sec.classList.add('hidden'));
  document.getElementById(sectionId).classList.remove('hidden');
}

// Styled alert function
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `custom-alert ${type}`;
  alertDiv.textContent = message;
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
      alertDiv.remove();
  }, 3000);
}

// PDF Merge Functions
let pdfFiles = [];
let pdfInputContainer = document.createElement('div');
document.querySelector('#merge').insertBefore(pdfInputContainer, document.querySelector('#merge .buttons'));

function addPDF() {
    const newInput = document.createElement('input');
    newInput.type = 'file';
    newInput.accept = '.pdf';
    newInput.className = 'additional-pdf';
    newInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            pdfFiles.push(...Array.from(e.target.files));
            showAlert('PDF file added successfully');
        }
    });
    pdfInputContainer.appendChild(newInput); // Changed to appendChild to add at bottom
    newInput.click();
}

function clearMerge() {
    pdfFiles = [];
    document.getElementById('mergePDFs').value = '';
    pdfInputContainer.innerHTML = '';
    showAlert('All PDF files cleared');
}

async function mergePDF() {
  if (pdfFiles.length === 0) {
      showAlert('Please select at least one PDF file', 'error');
      return;
  }

  try {
      const mergedPdf = await PDFLib.PDFDocument.create();
      
      for (const file of pdfFiles) {
          const fileData = await file.arrayBuffer();
          const pdf = await PDFLib.PDFDocument.load(fileData);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedPdfFile = await mergedPdf.save();
      const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.pdf';
      a.click();
      URL.revokeObjectURL(url);
      
      showAlert('PDFs merged successfully');
  } catch (error) {
      showAlert('Error merging PDFs: ' + error.message, 'error');
  }
}

// Image to Excel Functions
let images = [];
let imageInputContainer = document.createElement('div');
document.querySelector('#image').insertBefore(imageInputContainer, document.querySelector('#image button'));

document.getElementById('imageInput').addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
        images = Array.from(e.target.files); // Ensure images array is updated
        showAlert('Image file added successfully');
        
        // Display selected file names
        imageInputContainer.innerHTML = '';
        images.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.textContent = file.name;
            fileDiv.style.margin = '5px 0';
            imageInputContainer.appendChild(fileDiv);
        });
    }
});

function clearImage() {
    images = [];
    imageInputContainer.innerHTML = '';
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.value = '';
    }
    showAlert('All image files cleared');
}

async function preprocessImage(file) {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  // Ensure the image is fully loaded before proceeding
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let { width, height } = img;
  const MIN_WIDTH_FOR_OCR = 1200; // You can adjust this value
  if (img.width < MIN_WIDTH_FOR_OCR) {
    const scaleFactor = MIN_WIDTH_FOR_OCR / img.width;
    width = MIN_WIDTH_FOR_OCR;
    height = Math.round(img.height * scaleFactor);
  }
  canvas.width = img.width;
  canvas.height = img.height;

  // Convert to grayscale
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg; // red
      data[i + 1] = avg; // green
      data[i + 2] = avg; // blue
  }
  ctx.putImageData(imageData, 0, 0);

  URL.revokeObjectURL(img.src); // Clean up object URL after use
  return canvas.toDataURL(); // Returns a base64 encoded image string
}

async function imageToExcel() {
    if (!images || images.length === 0) {
        showAlert('Please select an image file', 'error');
        return;
    }
    try {
        // Create progress bar
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            text-align: center;
            z-index: 1000;
        `;
        
        const progressText = document.createElement('div');
        progressText.textContent = 'Processing image...';
        progressText.style.marginBottom = '10px';
        
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 200px;
            height: 10px;
            background: #f0f0f0;
            border-radius: 5px;
            overflow: hidden;
        `;
        
        const progressFill = document.createElement('div');
        progressFill.style.cssText = `
            width: 0%;
            height: 100%;
            background: #2196F3;
            transition: width 0.3s;
        `;
        
        progressBar.appendChild(progressFill);
        progressContainer.appendChild(progressText);
        progressContainer.appendChild(progressBar);
        document.body.appendChild(progressContainer);

        // Process each image
        for (const file of images) {
          progressText.textContent = `Processing ${file.name}...`;
          progressFill.style.width = '30%'; // Start at 30%
          const preprocessedImage = await preprocessImage(file);
          
          const result = await Tesseract.recognize(
            preprocessedImage, // Pass the preprocessed image data URL
            'eng',
            {
              logger: m => {
                if (m.status === 'recognizing text') {
                  progressFill.style.width = `${30 + (m.progress * 60)}%`;
                }
              },
              // PSM 6 is a good general attempt for blocks of text.
              // For sparse tables or tables with clear columns, PSM 4 or PSM 11/12 might be better.
              // You may need to experiment with this value based on your typical images.
              tessedit_pageseg_mode: '6' 
            }
          );

          const rawOcrText = result.data.text;
          const lines = rawOcrText.split('\n');

          const dateRegex = /^\d{2}-\d{2}-\d{4}/; // Matches DD-MM-YYYY at the start of a line
          const dataLines = lines.filter(line => {
              const trimmedLine = line.trim();
              return dateRegex.test(trimmedLine) || trimmedLine.startsWith("ARENA Total");
          });

          let maxColumns = 0;
          const processedDataRows = dataLines.map(line => {
            const trimmedLine = line.trim();
            const cells = trimmedLine.split(/\s{2,}/) 
                                     .map(cell => cell.trim().replace(/[^a-zA-Z0-9\s.,\-()]/g, ''));
            if (cells.length > maxColumns) {
              maxColumns = cells.length;
            }
            return cells;
          });

          const structuredRows = processedDataRows.map(cells => {
            const paddedCells = [...cells];
            while (paddedCells.length < maxColumns && maxColumns > 0) { // ensure maxColumns is positive
              paddedCells.push('');
            }
            return paddedCells;
          }).filter(row => row.some(cell => cell && cell.trim().length > 0));

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet(structuredRows);
          XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            
            // Fixed download button
            const downloadBtn = document.createElement('button');
            const excelFileName = file.name.replace(/\.(png|jpe?g|gif|bmp|webp)$/i, '.xlsx');
            downloadBtn.textContent = `Download ${excelFileName}`;
            downloadBtn.style.cssText = `
                display: block;
                margin: 10px auto;
                padding: 8px 16px;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            `;
            downloadBtn.onclick = () => {
                XLSX.writeFile(wb, excelFileName);
            };
            progressContainer.appendChild(downloadBtn);
        }

        progressText.textContent = 'Processing complete!';
        progressFill.style.width = '100%'; // Complete progression
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            display: block;
            margin: 10px auto;
            padding: 8px 16px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        closeBtn.onclick = () => {
            progressContainer.remove();
        };
        progressContainer.appendChild(closeBtn);

        showAlert('Images processed successfully');
    } catch (error) {
        showAlert('Error converting image: ' + error.message, 'error');
        if (progressContainer) {
            progressContainer.remove();
        }
    }
}

// PDF to Excel Functions
let pdfToExcelFiles = [];
let pdfToExcelContainer = document.createElement('div');
document.querySelector('#pdf').insertBefore(pdfToExcelContainer, document.querySelector('#pdf button'));

function clearPdfToExcel() {
    pdfToExcelFiles = [];
    document.getElementById('pdfInput').value = '';
    pdfToExcelContainer.innerHTML = '';
    showAlert('All PDF files cleared');
}

async function pdfToExcel() {
  const fileInput = document.getElementById('pdfInput');
  if (fileInput.files.length === 0) {
      showAlert('Please select a PDF file', 'error');
      return;
  }

  try {
      showAlert('Processing PDF...');
      const file = fileInput.files[0];
      const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
      
      let textContent = [];
      for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          const pageText = text.items.map(item => item.str).join(' ');
          textContent.push([pageText]);
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(textContent);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, 'converted_pdf.xlsx');
      
      showAlert('PDF converted to Excel successfully');
  } catch (error) {
      showAlert('Error converting PDF: ' + error.message, 'error');
  }
}

// Add alert styles
const style = document.createElement('style');
style.textContent = `
.custom-alert {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 5px;
  color: white;
  z-index: 1000;
  animation: slideIn 0.5s ease-out;
}

.custom-alert.info {
  background-color: #2196F3;
}

.custom-alert.error {
  background-color: #f44336;
}

@keyframes slideIn {
  from {
      transform: translateX(100%);
      opacity: 0;
  }
  to {
      transform: translateX(0);
      opacity: 1;
  }
}
`;
document.head.appendChild(style);



// Calculator Functions
const calculatorButtons = document.querySelectorAll(".calculator button");
const display = document.getElementById("display");

function append(value) {
  display.value += value;
}

function clearDisplay() {
  display.value = "";
}

function backspace() {
  display.value = display.value.slice(0, -1);
}

function calculate() {
  try {
    display.value = eval(display.value.replace('%', '/100'));
  } catch {
    display.value = "Error";
  }
}

// Keyboard input support
document.addEventListener("keydown", function (e) {
  const key = e.key;

  if (!isNaN(key) || ['+', '-', '*', '/', '.', '%'].includes(key)) {
    append(key);
  } else if (key === 'Enter') {
    e.preventDefault();
    calculate();
  } else if (key === 'Backspace') {
    backspace();
  } else if (key === 'Escape') {
    clearDisplay();
  }
});

/**
 * XLSX/CSV to JSON/CSV Converter
 * Usage: Add an <input type="file" id="fileInput" multiple> and two buttons to call convertFiles('json') or convertFiles('csv')
 */
function convertFiles(type) {
  const files = document.getElementById('fileInput').files;
  if (!files.length) return alert('Please select at least one file');

  showAlert('Processing...');

  let processedCount = 0;
  const totalFiles = files.length;

  [...files].forEach(file => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const filename = file.name.replace(/\.(xlsx|xls|csv)/i, '');

        if (type === 'csv') {
          const csv = XLSX.utils.sheet_to_csv(sheet);
          downloadFile(csv, `${filename}.csv`, 'text/csv');
        } else {
          const jsonString = JSON.stringify(json, null, 2);
          downloadFile(jsonString, `${filename}.json`, 'application/json');
        }
      });

      processedCount++;
      if (processedCount === totalFiles) {
        showAlert('Conversion complete!', 'info');
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function clearFileInput() {
    document.getElementById('fileInput').value = '';
    document.getElementById('output').innerHTML = ''; // Clear output for XLSX/CSV to JSON
    showAlert('All CSV & JSON files cleared');
}

function downloadFile(data, filename, mime) {
  const blob = new Blob([data], { type: mime });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function consolidateData() {
  const input = document.getElementById('consolidateInput');
  const files = Array.from(input.files);
  if (!files.length) {
    showAlert('Please select a folder with Excel/CSV files.', 'error');
    return;
  }

  showAlert('Processing...');

  // Group files by their immediate subfolder
  const folderMap = {};
  files.forEach(file => {
    // Get subfolder name (first part after root)
    const path = file.webkitRelativePath || file.name;
    const parts = path.split('/');
    // If files are in root, skip (we want only subfolders)
    if (parts.length < 2) return;
    const subfolder = parts[1];
    if (!folderMap[subfolder]) folderMap[subfolder] = [];
    folderMap[subfolder].push(file);
  });

  // For each subfolder, consolidate its files
  const consolidateFolder = async (folderName, folderFiles) => {
    let masterHeader = null;
    let consolidatedRows = [];
    let headerSet = false;

    const processFile = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function (e) {
          let workbook;
          const data = new Uint8Array(e.target.result);
          try {
            workbook = XLSX.read(data, { type: 'array' });
          } catch {
            return resolve(); // skip unreadable files
          }
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (!rows.length) return;
            if (!headerSet) {
              masterHeader = rows[0];
              consolidatedRows.push(masterHeader);
              headerSet = true;
            }
            // For all but the first file/sheet, skip header row
            const dataRows = headerSet ? rows.slice(1) : rows;
            // Only keep rows where length matches header, and map to header order
            dataRows.forEach(row => {
              // Map row to master header order
              const mappedRow = masterHeader.map((h, idx) => row[idx] !== undefined ? row[idx] : '');
              if (mappedRow.length === masterHeader.length) {
                consolidatedRows.push(mappedRow);
              }
            });
          });
          resolve();
        };
        reader.readAsArrayBuffer(file);
      });
    };

    for (const file of folderFiles) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (['xlsx', 'xls', 'csv'].includes(ext)) {
        await processFile(file);
      }
    }
    if (!masterHeader) {
      showAlert(`No valid Excel/CSV data found in ${folderName}.`, 'error');
      return;
    }
    // Create workbook and save
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(consolidatedRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Consolidated');
    XLSX.writeFile(wb, `${folderName}_consolidated.xlsx`);
  };

  (async () => {
    for (const [folderName, folderFiles] of Object.entries(folderMap)) {
      await consolidateFolder(folderName, folderFiles);
    }
    showAlert('All folders consolidated!', 'info');
  })();
}

