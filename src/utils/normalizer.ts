import Fuse from 'fuse.js';
import {
  NormalizedStudent,
  SchemaField,
  FieldDefinition,
  ColumnMappingInfo
} from '../types/normalization';

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: 'studentName',
    label: 'Student Name',
    aliases: ['Name', 'Student Name', 'Student', 'Child Name', 'Full Name', 'Candidate Name', 'StudentName', 'Child']
  },
  {
    key: 'fatherName',
    label: "Father's Name",
    aliases: ['Father', "Father's Name", 'Father Name', 'F Name', 'Parent Name', 'Guardian', 'Father/Guardian', 'FatherName']
  },
  {
    key: 'motherName',
    label: "Mother's Name",
    aliases: ['Mother', "Mother's Name", 'Mother Name', 'M Name', 'MotherName', "Mother's Full Name"]
  },
  {
    key: 'rollNumber',
    label: 'Roll Number',
    aliases: ['Roll', 'Roll No', 'Roll Number', 'Roll#', 'Roll ID', 'Student Roll', 'RollNo', 'RollNumber']
  },
  {
    key: 'admissionNumber',
    label: 'Admission Number',
    aliases: ['Admission', 'Admission No', 'Admission Number', 'Adm No', 'Registration Number', 'Reg No', 'AdmNo', 'AdmissionNo', 'RegNo']
  },
  {
    key: 'class',
    label: 'Class',
    aliases: ['Class', 'Grade', 'Standard', 'Std', 'Class/Grade']
  },
  {
    key: 'section',
    label: 'Section',
    aliases: ['Section', 'Sec', 'Class Section']
  },
  {
    key: 'dateOfBirth',
    label: 'Date of Birth',
    aliases: ['Date of Birth', 'DOB', 'Birth Date', 'DateofBirth', 'BirthDate', 'Date of birth']
  },
  {
    key: 'gender',
    label: 'Gender',
    aliases: ['Gender', 'Sex']
  },
  {
    key: 'phoneNumber',
    label: 'Phone Number',
    aliases: ['Phone Number', 'Phone', 'Mobile', 'Contact', 'Contact No', 'Mobile No', 'PhoneNumber', 'MobileNumber', 'Telephone']
  },
  {
    key: 'address',
    label: 'Address',
    aliases: ['Address', 'Residence', 'Location', 'Home Address', 'Permanent Address']
  },
  {
    key: 'feeStatus',
    label: 'Fee Status',
    aliases: ['Fee', 'Fees', 'Fee Status', 'Payment Status', 'Paid', 'Due', 'Fee Paid', 'Status', 'Fees Status', 'PaymentStatus']
  }
];

// Setup Fuse.js search data
const fuseData: { field: SchemaField; alias: string }[] = [];
FIELD_DEFINITIONS.forEach(def => {
  def.aliases.forEach(alias => {
    fuseData.push({ field: def.key, alias });
  });
});

const fuse = new Fuse(fuseData, {
  keys: ['alias'],
  includeScore: true,
  threshold: 0.4,
  distance: 100
});

export function detectHeaderRow(rows: any[][]): { headerRowIndex: number; headers: string[] } {
  if (rows.length === 0) return { headerRowIndex: 0, headers: [] };

  let bestRowIndex = 0;
  let maxMatches = -1;
  let bestHeaders: string[] = [];

  const allAliases = new Set<string>();
  FIELD_DEFINITIONS.forEach(f => {
    f.aliases.forEach(a => allAliases.add(a.toLowerCase().trim()));
  });

  const rowsToCheck = Math.min(rows.length, 15);
  for (let r = 0; r < rowsToCheck; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;

    let matchCount = 0;
    const currentHeaders: string[] = [];

    row.forEach(cell => {
      const cellStr = cell !== null && cell !== undefined ? String(cell).trim() : '';
      currentHeaders.push(cellStr);
      if (cellStr) {
        const cleaned = cellStr.toLowerCase();
        if (allAliases.has(cleaned)) {
          matchCount += 2;
        } else {
          const isCommonHeader = Array.from(allAliases).some(alias =>
            cleaned.includes(alias) || alias.includes(cleaned)
          );
          if (isCommonHeader && cleaned.length > 2) {
            matchCount += 1;
          }
        }
      }
    });

    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      bestRowIndex = r;
      bestHeaders = currentHeaders;
    }
  }

  // Fallback if no matching headers found
  if (maxMatches <= 1) {
    for (let r = 0; r < rowsToCheck; r++) {
      const row = rows[r];
      if (row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
        return {
          headerRowIndex: r,
          headers: row.map(cell => cell !== null && cell !== undefined ? String(cell).trim() : '')
        };
      }
    }
  }

  return { headerRowIndex: bestRowIndex, headers: bestHeaders };
}

interface CellProfileScore {
  field: SchemaField;
  score: number;
}

export function classifyCell(cellVal: any): CellProfileScore[] {
  if (cellVal === null || cellVal === undefined) return [];
  const str = String(cellVal).trim();
  if (!str) return [];

  const scores: Record<SchemaField, number> = {
    studentName: 0, fatherName: 0, motherName: 0, rollNumber: 0, admissionNumber: 0,
    class: 0, section: 0, dateOfBirth: 0, gender: 0, phoneNumber: 0, address: 0, feeStatus: 0
  };

  const namePattern = /^[a-zA-Z\s.']{2,40}$/;

  // 1. Gender Classifier
  if (/^(m|f|male|female|boy|girl)$/i.test(str)) scores.gender += 1;

  // 2. Fee Status Classifier
  if (/^(paid|due|unpaid|pending|clear|fees?\s*paid|fees?\s*due)$/i.test(str)) scores.feeStatus += 1;

  // 3. Phone Number Classifier
  const cleanPhone = str.replace(/[^\d+]/g, '');
  if ((cleanPhone.startsWith('+') && cleanPhone.length >= 8 && cleanPhone.length <= 15) ||
      (/^\d{7,15}$/.test(cleanPhone))) scores.phoneNumber += 1;

  // 4. Date of Birth Classifier
  if (cellVal instanceof Date) {
    const year = cellVal.getFullYear();
    if (year >= 1990 && year <= 2026) scores.dateOfBirth += 1;
  } else if (typeof cellVal === 'number' && cellVal > 30000 && cellVal < 50000) {
    scores.dateOfBirth += 1;
  } else {
    const cleanStr = str.replace(/\s+/g, '');
    if (/^\d{1,4}[-./]\d{1,2}[-./]\d{1,4}$/.test(cleanStr)) {
      const parts = cleanStr.split(/[-./]/);
      const hasYear = parts.some(p => {
        const num = parseInt(p, 10);
        return num >= 1990 && num <= 2026;
      });
      if (hasYear) scores.dateOfBirth += 1;
    }
  }

  // 5. Class Classifier
  const isRoman = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i.test(str);
  const isClassWord = /^(class|grade|std|standard)\s*([a-zA-Z0-9]+)(\s+(section|sec)?\s*[a-zA-Z])?$/i.test(str);
  const isClassHyphenSec = /^\d+\s*[-/ ]\s*[a-zA-Z]$/.test(str);
  const isSingleClassNum = /^\d+$/.test(str) && parseInt(str, 10) >= 1 && parseInt(str, 10) <= 12;
  if (isRoman || isClassWord || isClassHyphenSec || isSingleClassNum) scores.class += 1;

  // 6. Section Classifier
  if (/^[a-df-z]$/i.test(str) || /^(section|sec)\s*[a-zA-Z]$/i.test(str)) scores.section += 1;

  // 7. Roll Number Classifier
  const isRollWord = /^roll\s*#?\s*\d+$/i.test(str);
  const isRollNum = /^\d+$/.test(str) && parseInt(str, 10) >= 1 && parseInt(str, 10) <= 200;
  if (isRollWord || isRollNum) scores.rollNumber += 1;

  // 8. Admission Number Classifier
  const isAdmCode = /^[a-zA-Z]{2,5}\d{3,8}$/.test(str);
  const isAdmWord = /^(adm|reg|enroll|registration)\s*#?\s*[a-zA-Z0-9-]+$/i.test(str);
  const isLargeNum = /^\d{4,8}$/.test(str);
  if (isAdmCode || isAdmWord || isLargeNum) scores.admissionNumber += 1;

  // 9. Address Classifier
  const addressKeywords = /(street|st|road|rd|lane|ave|h\.no|flat|city|colony|sector|block|phase|nagar|town)/i;
  if (addressKeywords.test(str) || (str.split(/\s+/).length >= 4 && !namePattern.test(str) && !/class|grade|section/i.test(str))) scores.address += 1;

  // 10. Names Classifier
  if (namePattern.test(str) && str.split(/\s+/).length >= 2) {
    scores.studentName += 1;
    scores.fatherName += 1;
    scores.motherName += 1;
  }

  const result: CellProfileScore[] = [];
  Object.keys(scores).forEach(key => {
    const field = key as SchemaField;
    if (scores[field] > 0) {
      result.push({ field, score: scores[field] });
    }
  });

  return result.sort((a, b) => b.score - a.score);
}

export function profileColumnCells(
  rawRows: any[][],
  headerRowIndex: number,
  colIdx: number
): CellProfileScore[] {
  const startRow = Math.max(0, headerRowIndex + 1);
  const endRow = Math.min(rawRows.length, startRow + 50);

  let totalNonEmpty = 0;
  const matchCounts: Record<SchemaField, number> = {
    studentName: 0, fatherName: 0, motherName: 0, rollNumber: 0, admissionNumber: 0,
    class: 0, section: 0, dateOfBirth: 0, gender: 0, phoneNumber: 0, address: 0, feeStatus: 0
  };

  for (let r = startRow; r < endRow; r++) {
    const row = rawRows[r];
    if (!row || colIdx >= row.length) continue;

    const cellVal = row[colIdx];
    if (cellVal === null || cellVal === undefined || String(cellVal).trim() === '') continue;

    totalNonEmpty++;
    const scores = classifyCell(cellVal);
    scores.forEach(s => {
      matchCounts[s.field] += s.score;
    });
  }

  if (totalNonEmpty === 0) return [];

  const result: CellProfileScore[] = [];
  Object.keys(matchCounts).forEach(key => {
    const field = key as SchemaField;
    result.push({ field, score: matchCounts[field] / totalNonEmpty });
  });

  return result.sort((a, b) => b.score - a.score);
}

function isGenericHeader(header: string): boolean {
  const cleaned = header.trim().toLowerCase();
  if (!cleaned) return true;

  if (/^(col|column|field)\s*[a-z0-9]$/i.test(cleaned)) return true;
  if (/^f\d+$/i.test(cleaned)) return true;
  if (/^(s\.?no|serial|sr)\.?\s*(no)?\.?$/i.test(cleaned)) return true;
  if (/^\d+$/.test(cleaned)) return true;
  if (cleaned.length <= 2 && !['sec', 'dob', 'sex'].includes(cleaned)) return true;

  return false;
}

export function autoMapHeaders(headers: string[], rawRows: any[][] = [], headerRowIndex: number = 0): ColumnMappingInfo[] {
  const mappings: ColumnMappingInfo[] = [];
  const mappedFields = new Set<SchemaField>();

  headers.forEach((header) => {
    const cleanedHeader = header.trim();
    if (!cleanedHeader || isGenericHeader(cleanedHeader)) {
      mappings.push({ detectedHeader: header, mappedField: null, confidence: 0 });
      return;
    }

    let exactField: SchemaField | null = null;
    for (const def of FIELD_DEFINITIONS) {
      if (def.aliases.some(alias => alias.toLowerCase() === cleanedHeader.toLowerCase())) {
        exactField = def.key;
        break;
      }
    }

    if (exactField) {
      mappings.push({ detectedHeader: header, mappedField: exactField, confidence: 1.0 });
      mappedFields.add(exactField);
      return;
    }

    const results = fuse.search(cleanedHeader);
    if (results.length > 0) {
      const bestMatch = results[0];
      const score = bestMatch.score ?? 1;
      const confidence = Math.max(0, 1 - score);

      if (confidence >= 0.6) {
        mappings.push({ detectedHeader: header, mappedField: bestMatch.item.field, confidence: parseFloat(confidence.toFixed(2)) });
        mappedFields.add(bestMatch.item.field);
        return;
      }
    }

    mappings.push({ detectedHeader: header, mappedField: null, confidence: 0 });
  });

  if (rawRows.length > 0) {
    let nameColumnsCount = 0;
    mappings.forEach(m => {
      if (m.mappedField === 'studentName') nameColumnsCount = Math.max(nameColumnsCount, 1);
      if (m.mappedField === 'fatherName') nameColumnsCount = Math.max(nameColumnsCount, 2);
      if (m.mappedField === 'motherName') nameColumnsCount = Math.max(nameColumnsCount, 3);
    });

    mappings.forEach((mapping, colIdx) => {
      if (mapping.mappedField !== null) return;
      const cellScores = profileColumnCells(rawRows, headerRowIndex, colIdx);
      if (cellScores.length === 0) return;

      const topScore = cellScores[0];
      if (topScore.score >= 0.4) {
        if (topScore.field === 'studentName' || topScore.field === 'fatherName' || topScore.field === 'motherName') {
          nameColumnsCount++;
          let assignedNameField: SchemaField = 'studentName';
          if (nameColumnsCount === 2) assignedNameField = 'fatherName';
          else if (nameColumnsCount >= 3) assignedNameField = 'motherName';

          if (!mappedFields.has(assignedNameField)) {
            mapping.mappedField = assignedNameField;
            mapping.confidence = parseFloat(topScore.score.toFixed(2));
            mappedFields.add(assignedNameField);
          }
        } else {
          if (!mappedFields.has(topScore.field)) {
            mapping.mappedField = topScore.field;
            mapping.confidence = parseFloat(topScore.score.toFixed(2));
            mappedFields.add(topScore.field);
          }
        }
      }
    });
  }

  const schemaFieldIndices: Record<string, number[]> = {};
  mappings.forEach((mapping, index) => {
    if (mapping.mappedField) {
      if (!schemaFieldIndices[mapping.mappedField]) schemaFieldIndices[mapping.mappedField] = [];
      schemaFieldIndices[mapping.mappedField].push(index);
    }
  });

  Object.entries(schemaFieldIndices).forEach(([field, indices]) => {
    if (indices.length > 1) {
      let bestIndex = indices[0];
      let maxConf = mappings[bestIndex].confidence;
      for (let i = 1; i < indices.length; i++) {
        if (mappings[indices[i]].confidence > maxConf) {
          maxConf = mappings[indices[i]].confidence;
          bestIndex = indices[i];
        }
      }
      indices.forEach(idx => {
        if (idx !== bestIndex) {
          mappings[idx].mappedField = null;
          mappings[idx].confidence = 0;
        }
      });
    }
  });

  return mappings;
}

export function romanToArabic(val: string): string {
  const romanMap: Record<string, string> = {
    i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6',
    vii: '7', viii: '8', ix: '9', x: '10', xi: '11', xii: '12'
  };
  const cleanVal = val.trim().toLowerCase();
  return romanMap[cleanVal] || val;
}

export function parseClassAndSection(classStr: string, sectionStr: string): { classVal: string; sectionVal: string } {
  const cleanClass = classStr ? String(classStr).trim() : '';
  const cleanSection = sectionStr ? String(sectionStr).trim() : '';

  if (!cleanClass) return { classVal: '', sectionVal: cleanSection };

  const patterns = [
    /(?:class|grade|standard|std)\s*([a-zA-Z0-9]+)\s+(?:section|sec)\s*([a-zA-Z])/i,
    /(?:class|grade|standard|std)\s*([a-zA-Z0-9]+)\s+([a-zA-Z])/i,
    /^([a-zA-Z0-9]+)\s*[-/ ]\s*([a-zA-Z])$/
  ];

  for (const regex of patterns) {
    const match = cleanClass.match(regex);
    if (match) {
      return { classVal: romanToArabic(match[1]), sectionVal: cleanSection || match[2].toUpperCase() };
    }
  }

  const simpleMatch = cleanClass.match(/^([a-zA-Z0-9]+)([a-zA-Z])$/);
  if (simpleMatch) {
    const firstPart = simpleMatch[1];
    if (/^\d+$/.test(firstPart) || /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i.test(firstPart)) {
      return { classVal: romanToArabic(firstPart), sectionVal: cleanSection || simpleMatch[2].toUpperCase() };
    }
  }

  if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i.test(cleanClass)) {
    return { classVal: romanToArabic(cleanClass), sectionVal: cleanSection };
  }

  const classNumericMatch = cleanClass.match(/(?:class|grade|standard|std)\s*([a-zA-Z0-9]+)/i);
  if (classNumericMatch) {
    return { classVal: romanToArabic(classNumericMatch[1]), sectionVal: cleanSection };
  }

  const digitsMatch = cleanClass.match(/^(\d+)/);
  if (digitsMatch) {
    return { classVal: digitsMatch[1], sectionVal: cleanSection };
  }

  return { classVal: cleanClass, sectionVal: cleanSection };
}

export function normalizeFeeStatus(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim().toLowerCase();
  if (!str) return '';

  if (str === 'paid' || str.includes('paid') || str.includes('yes') || str === 'clear') return 'Paid';
  if (str === 'due' || str.includes('due') || str.includes('no') || str === 'unpaid' || str === 'pending') return 'Due';
  return '';
}

export function normalizeGender(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim().toLowerCase();
  if (!str) return '';

  if (str === 'm' || str === 'male' || str === 'boy') return 'Male';
  if (str === 'f' || str === 'female' || str === 'girl') return 'Female';
  return '';
}

export function normalizePhoneNumber(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';

  return str.replace(/[^\d+]/g, '');
}

export function excelDateToJSDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = serial - Math.floor(serial) + 0.0000001;
  let totalSeconds = Math.floor(86400 * fractionalDay);
  const seconds = totalSeconds % 60;
  totalSeconds = Math.floor(totalSeconds / 60);
  const minutes = totalSeconds % 60;
  const hours = Math.floor(totalSeconds / 60);
  return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate(), hours, minutes, seconds);
}

export function normalizeDateOfBirth(val: any): string {
  if (val === null || val === undefined) return '';

  if (val instanceof Date) return formatDate(val);

  if (typeof val === 'number') {
    try { return formatDate(excelDateToJSDate(val)); } catch (e) {}
  }

  const str = String(val).trim();
  if (!str) return '';

  if (/^\d+(\.\d+)?$/.test(str)) {
    try { return formatDate(excelDateToJSDate(parseFloat(str))); } catch (e) {}
  }

  const dmyMatch = str.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10), month = parseInt(dmyMatch[2], 10), year = parseInt(dmyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const ymdMatch = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10), month = parseInt(ymdMatch[2], 10), day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const timestamp = Date.parse(str);
  if (!isNaN(timestamp)) return formatDate(new Date(timestamp));

  return str;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (isNaN(y) || isNaN(date.getMonth()) || isNaN(date.getDate())) return '';
  return `${y}-${m}-${d}`;
}

export function normalizeRows(
  rawRows: any[][],
  headerRowIndex: number,
  mappings: ColumnMappingInfo[]
): NormalizedStudent[] {
  const normalizedRecords: NormalizedStudent[] = [];

  const strictFields = ['gender', 'feeStatus', 'phoneNumber', 'dateOfBirth', 'class', 'section', 'rollNumber', 'admissionNumber', 'address'];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row) continue;

    const isEmptyRow = row.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
    if (isEmptyRow) continue;

    const studentData: Record<SchemaField, string> = {
      studentName: '', fatherName: '', motherName: '', rollNumber: '', admissionNumber: '',
      class: '', section: '', dateOfBirth: '', gender: '', phoneNumber: '', address: '', feeStatus: ''
    };

    let nameFieldsAssigned = 0;

    row.forEach((cellVal, colIdx) => {
      if (cellVal === null || cellVal === undefined || String(cellVal).trim() === '') return;

      const strVal = String(cellVal).trim();
      const scores = classifyCell(cellVal);
      const mappedField = colIdx < mappings.length ? mappings[colIdx].mappedField : null;

      let assignedField: SchemaField | null = null;

      if (scores.length > 0) {
        if (mappedField) {
          const mappedScoreObj = scores.find(s => s.field === mappedField);
          if (mappedScoreObj && mappedScoreObj.score === scores[0].score) {
            scores.sort((a, b) => {
              if (a.score !== b.score) return b.score - a.score;
              if (a.field === mappedField) return -1;
              if (b.field === mappedField) return 1;
              return 0;
            });
          }
        }

        const bestScore = scores[0];
        
        if (strictFields.includes(bestScore.field)) {
          assignedField = bestScore.field;
        } else {
          if (mappedField && !strictFields.includes(mappedField)) {
            assignedField = mappedField;
          } else if (bestScore.field === 'studentName' || bestScore.field === 'fatherName' || bestScore.field === 'motherName') {
            nameFieldsAssigned++;
            if (nameFieldsAssigned === 1) assignedField = 'studentName';
            else if (nameFieldsAssigned === 2) assignedField = 'fatherName';
            else assignedField = 'motherName';
          } else if (mappedField) {
            assignedField = mappedField;
          }
        }
      } else if (mappedField) {
        assignedField = mappedField;
      }

      if (assignedField) {
        if (!studentData[assignedField]) {
          studentData[assignedField] = strVal;
        } else if (['studentName', 'fatherName', 'motherName'].includes(assignedField)) {
          if (!studentData.studentName) studentData.studentName = strVal;
          else if (!studentData.fatherName) studentData.fatherName = strVal;
          else if (!studentData.motherName) studentData.motherName = strVal;
        }
      }
    });

    const { classVal, sectionVal } = parseClassAndSection(studentData.class, studentData.section);
    studentData.class = classVal;
    studentData.section = sectionVal;

    studentData.feeStatus = normalizeFeeStatus(studentData.feeStatus);
    studentData.gender = normalizeGender(studentData.gender);
    studentData.phoneNumber = normalizePhoneNumber(studentData.phoneNumber);
    studentData.dateOfBirth = normalizeDateOfBirth(studentData.dateOfBirth);

    const finalStudent: NormalizedStudent = {
      studentName: studentData.studentName ? String(studentData.studentName).trim() : '',
      fatherName: studentData.fatherName ? String(studentData.fatherName).trim() : '',
      motherName: studentData.motherName ? String(studentData.motherName).trim() : '',
      rollNumber: studentData.rollNumber ? String(studentData.rollNumber).trim() : '',
      admissionNumber: studentData.admissionNumber ? String(studentData.admissionNumber).trim() : '',
      class: studentData.class,
      section: studentData.section,
      dateOfBirth: studentData.dateOfBirth,
      gender: studentData.gender,
      phoneNumber: studentData.phoneNumber,
      address: studentData.address ? String(studentData.address).trim() : '',
      feeStatus: studentData.feeStatus
    };

    normalizedRecords.push(finalStudent);
  }

  return normalizedRecords;
}

export function splitRecordsByCompleteness(records: NormalizedStudent[]): {
  completedRecords: NormalizedStudent[];
  needsReviewRecords: NormalizedStudent[];
} {
  const completedRecords: NormalizedStudent[] = [];
  const needsReviewRecords: NormalizedStudent[] = [];

  records.forEach(record => {
    const hasBlankValue = Object.values(record).some(value => !String(value).trim());
    if (hasBlankValue) {
      needsReviewRecords.push(record);
    } else {
      completedRecords.push(record);
    }
  });

  return { completedRecords, needsReviewRecords };
}

export function calculateStats(records: NormalizedStudent[], mappings: ColumnMappingInfo[]): {
  processedRowCount: number;
  missingFieldsCount: number;
} {
  let missingCount = 0;
  const mappedFields = mappings
    .filter(m => m.mappedField !== null)
    .map(m => m.mappedField as SchemaField);

  records.forEach(rec => {
    mappedFields.forEach(field => {
      if (!rec[field]) {
        missingCount++;
      }
    });
  });

  return {
    processedRowCount: records.length,
    missingFieldsCount: missingCount
  };
}
