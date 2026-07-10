export interface NormalizedStudent {
  studentName: string;
  fatherName: string;
  motherName: string;
  rollNumber: string;
  admissionNumber: string;
  class: string;
  section: string;
  dateOfBirth: string;
  gender: string;
  phoneNumber: string;
  address: string;
  feeStatus: string;
}

export type SchemaField = keyof NormalizedStudent;

export interface FieldDefinition {
  key: SchemaField;
  label: string;
  aliases: string[];
}

export interface ColumnMappingInfo {
  detectedHeader: string;
  mappedField: SchemaField | null;
  confidence: number; // 0 to 1
}

export interface SheetProcessingResult {
  sheetName: string;
  originalRowCount: number;
  processedRowCount: number;
  missingFieldsCount: number;
  columnMappings: ColumnMappingInfo[];
  previewRecords: NormalizedStudent[];
  allRecords: NormalizedStudent[];
  completedRecords: NormalizedStudent[];
  needsReviewRecords: NormalizedStudent[];
  completedRecordCount: number;
  needsReviewRecordCount: number;
  headers: string[];
  rawRows: any[]; // Saved to allow re-normalization on the fly if user changes mappings
  headerRowIndex: number;
}

export interface FileProcessingResponse {
  fileName: string;
  sheets: SheetProcessingResult[];
}
