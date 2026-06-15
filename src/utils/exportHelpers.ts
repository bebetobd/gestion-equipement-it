export async function exportJsonToXlsx(rows: any[], filename: string, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export async function exportMultiSheetXlsx(sheets: {name:string, rows:any[]}[], filename: string){
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for(const s of sheets){
    const ws = XLSX.utils.json_to_sheet(s.rows || []);
    XLSX.utils.book_append_sheet(wb, ws, (s.name || 'Sheet').slice(0,31));
  }
  XLSX.writeFile(wb, filename);
}

export async function createPdfDocument(orientation: 'landscape' | 'portrait' = 'landscape') {
  const [jspdfMod, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable').catch(() => null),
  ]);
  const jsPDF = (jspdfMod.default ?? jspdfMod) as any;
  const autoTable = autoTableMod ? (autoTableMod.default || autoTableMod) as any : null;
  return { jsPDF, autoTable };
}

export async function exportRowsToPdf({ head, body, filename, title = '', orientation = 'landscape', tableOptions = {} }:{head:string[][], body:any[][], filename:string, title?:string, orientation?:'landscape'|'portrait', tableOptions?: any}){
  const { jsPDF, autoTable } = await createPdfDocument(orientation);
  const doc = new jsPDF({ orientation });
  if (title) {
    doc.setFontSize(14);
    doc.text(title, 14, 14);
    doc.setFontSize(9);
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 14, 21);
  }
  if (autoTable) {
    autoTable(doc, {
      startY: title ? 26 : 14,
      head,
      body,
      styles: { fontSize: 7, cellPadding: 2 },
      ...tableOptions,
    });
  }
  doc.save(filename);
}

export async function loadDocx() {
  return import('docx');
}

export async function exportDocxFromSections(children: any[], filename: string) {
  const docx = await import('docx');
  const { Packer, Document } = docx;
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
