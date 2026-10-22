import dayjs from 'dayjs';

// xlsx is large, so it is only fetched when someone actually clicks Export.
// `sheets` is [{ name, rows }] where rows are plain objects (keys become the header row).
export async function exportWorkbook(filenameBase, sheets) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
  }
  XLSX.writeFile(workbook, `${filenameBase}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
}
