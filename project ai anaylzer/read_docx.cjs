const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const docxPath = 'Indian_Property_Document_Fields_Reference.docx';

// Create a temp dir
const tempDir = path.join(__dirname, 'temp_docx');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

try {
  // Copy to temp.zip
  const zipPath = path.join(__dirname, 'temp.zip');
  fs.copyFileSync(docxPath, zipPath);
  
  // Use powershell to extract the zip
  execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`);

  // Read word/document.xml
  const xmlPath = path.join(tempDir, 'word', 'document.xml');
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');

  // Strip xml tags
  const textContent = xmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  console.log(textContent);
} catch (e) {
  console.error(e);
} finally {
  // Cleanup
  execSync(`powershell -Command "Remove-Item -Recurse -Force '${tempDir}'"`);
}
