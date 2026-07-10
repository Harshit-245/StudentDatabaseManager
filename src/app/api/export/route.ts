import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { FIELD_DEFINITIONS } from '@/utils/normalizer';

export async function POST(request: NextRequest) {
  try {
    const { records, sheetName, fileNamePrefix } = await request.json();

    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Invalid or missing records' }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName || 'Clean Data');

    // Define standard headers and column order
    const columns = FIELD_DEFINITIONS.map(def => ({
      header: def.label,
      key: def.key,
      width: 20
    }));

    worksheet.columns = columns;

    // Apply basic header formatting (premium dark styling)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' } // Sleek navy color
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.height = 28;

    // Add student records
    records.forEach(student => {
      const rowData: Record<string, string> = {};
      FIELD_DEFINITIONS.forEach(def => {
        rowData[def.key] = student[def.key] !== undefined && student[def.key] !== null ? String(student[def.key]) : '';
      });
      worksheet.addRow(rowData);
    });

    // Style and outline cell borders
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.height = 22;
      row.alignment = { vertical: 'middle' };

      // Zebra striping
      if (rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' }
        };
      }

      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
    });

    // Set dynamic column widths
    worksheet.columns.forEach(column => {
      let maxLen = 0;
      column.eachCell!({ includeEmpty: true }, cell => {
        const valStr = cell.value ? String(cell.value) : '';
        if (valStr.length > maxLen) {
          maxLen = valStr.length;
        }
      });
      column.width = Math.max(15, Math.min(35, maxLen + 3));
    });

    const buffer = await workbook.xlsx.writeBuffer();

    const safeSheetName = (sheetName || 'Clean Data').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Clean_Data';
    const outputName = `${fileNamePrefix || 'standardized'}_${safeSheetName}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${outputName}"`
      }
    });
  } catch (error: any) {
    console.error('Error during excel export:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred during excel export.' },
      { status: 500 }
    );
  }
}
