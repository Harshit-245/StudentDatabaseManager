import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import {
  detectHeaderRow,
  autoMapHeaders,
  normalizeRows,
  calculateStats,
  splitRecordsByCompleteness
} from '@/utils/normalizer';
import { SheetProcessingResult } from '@/types/normalization';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Case 1: Re-normalize with updated mappings (JSON payload)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { rawRows, headerRowIndex, mappings } = body;

      if (!rawRows || typeof headerRowIndex !== 'number' || !mappings) {
        return NextResponse.json(
          { error: 'Missing parameters: rawRows, headerRowIndex, mappings' },
          { status: 400 }
        );
      }

      const normalizedRecords = normalizeRows(rawRows, headerRowIndex, mappings);
      const stats = calculateStats(normalizedRecords, mappings);

      return NextResponse.json({
        success: true,
        records: normalizedRecords,
        ...stats
      });
    }

    // Case 2: Ingest new spreadsheet file (Multipart form data)
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    const sheetsResult: SheetProcessingResult[] = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: ''
      });

      if (rawRows.length === 0) return;

      const { headerRowIndex, headers } = detectHeaderRow(rawRows);
      const mappings = autoMapHeaders(headers, rawRows, headerRowIndex);
      const allRecords = normalizeRows(rawRows, headerRowIndex, mappings);
      const { completedRecords, needsReviewRecords } = splitRecordsByCompleteness(allRecords);
      const stats = calculateStats(allRecords, mappings);
      const previewRecords = allRecords.slice(0, 10);

      sheetsResult.push({
        sheetName,
        originalRowCount: Math.max(0, rawRows.length - (headerRowIndex + 1)),
        processedRowCount: stats.processedRowCount,
        missingFieldsCount: needsReviewRecords.length,
        columnMappings: mappings,
        previewRecords,
        allRecords,
        completedRecords,
        needsReviewRecords,
        completedRecordCount: completedRecords.length,
        needsReviewRecordCount: needsReviewRecords.length,
        headers,
        rawRows,
        headerRowIndex
      });
    });

    return NextResponse.json({
      fileName: file.name,
      sheets: sheetsResult
    });
  } catch (error: any) {
    console.error('Error during normalization:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred during file processing.' },
      { status: 500 }
    );
  }
}
