# Project Logic Explained

## What this project does

This project is a helper tool for school student lists. It takes a messy spreadsheet and turns it into a clean, organized student database.

## How it works for a person

1. You upload a spreadsheet file (Excel or CSV).
2. The app reads the file and looks for the row that contains the column titles, like "Name", "Class", or "Phone".
3. It tries to match each column from the file to the standard student fields the app expects.
4. It then reads each student row and fills the correct fields.
5. Finally, it allows you to download a clean Excel file with only the correct student columns.

## How it is built

- The project is built using **Next.js**, a web application framework.
- The website is split into two main parts:
  1. **Front end**: the page the user sees and interacts with.
  2. **Back end**: the code that reads, cleans, and exports the spreadsheet.
- The code is written in **TypeScript**, a version of JavaScript that adds some safety checks.
- Files are organized so the user interface and the data processing are separated.

## The main idea

- The app is built with a web framework called Next.js.
- It has a front page where a user can upload a file.
- It sends the file to a back-end process that reads and cleans the data.
- The back end is written in JavaScript/TypeScript and uses rules to guess what each column means.

## What the app can fix

- Detects column headers even if they are written in different ways, such as:
  - "Full Name" or "Student Name"
  - "Mobile" or "Phone Number"
  - "Class" or "Grade"
- Reads messy data rows and tries to place each piece of information in the right field.
- Standardizes values like gender, fee status, class, and date of birth.

## How it organizes the data

The app does not sort the rows in alphabetical order. It organizes data by identifying what each column means and placing each value into the right student field.

1. **Finds the header row**
   - It checks the first rows and chooses the one that looks like column titles.
   - It recognizes known words such as `Name`, `DOB`, `Phone`, `Fee`, `Class`, and `Section`.

2. **Matches each header to a standard field**
   - Each column header is compared with a known list of fields like `studentName`, `phoneNumber`, and `feeStatus`.
   - If the header is clear, the column is mapped immediately.

3. **Guesses the column type from the values**
   - If headers are unclear or missing, the app looks at the actual cells in that column.
   - It checks patterns such as:
     - phone numbers → `phoneNumber`
     - dates → `dateOfBirth`
     - `paid` or `due` → `feeStatus`
     - `male` or `female` → `gender`

4. **Reads each row and fills the fields**
   - For every student row, it assigns each cell to the mapped field.
   - It uses both the header mapping and the cell content to decide where the value belongs.

5. **Cleans and standardizes the values**
   - Dates are converted to `YYYY-MM-DD`.
   - Gender is fixed to `Male` or `Female`.
   - Phone numbers are cleaned to numbers only.
   - Fee status becomes `Paid` or `Due`.

This is how the app “organizes” messy spreadsheets: not by sorting rows, but by putting each piece of data into the correct category and making it consistent.

## Exact code used to organize data

The main logic is in `src/utils/normalizer.ts`.

### 1. Detect the header row

This function checks the first rows and picks the one that looks most like column titles:

```ts
export function detectHeaderRow(rows: any[][]) {
  let bestRowIndex = 0;
  let maxMatches = -1;
  rows.slice(0, 15).forEach((row, r) => {
    let matchCount = 0;
    row.forEach(cell => {
      const cellStr = String(cell || '').trim().toLowerCase();
      if (allAliases.has(cellStr)) matchCount += 2;
      else if (common matches) matchCount += 1;
    });
    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      bestRowIndex = r;
    }
  });
  return { headerRowIndex: bestRowIndex, headers: rows[bestRowIndex] };
}
```

### 2. Match column headers to known fields

This function uses known field names and fuzzy matching to map columns:

```ts
export function autoMapHeaders(headers: string[], rawRows: any[][] = [], headerRowIndex = 0) {
  const mappings: ColumnMappingInfo[] = [];
  headers.forEach(header => {
    const cleaned = header.trim();
    const exactField = FIELD_DEFINITIONS.find(def =>
      def.aliases.some(alias => alias.toLowerCase() === cleaned.toLowerCase())
    );
    if (exactField) {
      mappings.push({ detectedHeader: header, mappedField: exactField.key, confidence: 1.0 });
      return;
    }
    const results = fuse.search(cleaned);
    if (results.length > 0 && confidence >= 0.6) {
      mappings.push({ detectedHeader: header, mappedField: results[0].item.field, confidence });
    } else {
      mappings.push({ detectedHeader: header, mappedField: null, confidence: 0 });
    }
  });
  return mappings;
}
```

### 3. Guess a column type from actual values

If the header is unclear, this code looks at the column values:

```ts
export function profileColumnCells(rawRows: any[][], headerRowIndex: number, colIdx: number) {
  const matchCounts = { studentName: 0, gender: 0, phoneNumber: 0, ... };
  for (let r = headerRowIndex + 1; r < Math.min(rawRows.length, headerRowIndex + 51); r++) {
    const scores = classifyCell(rawRows[r][colIdx]);
    scores.forEach(s => matchCounts[s.field] += s.score);
  }
  return sorted matchCounts by score;
}
```

### 4. Normalize each student row

This is the step that builds the final clean data:

```ts
export function normalizeRows(rawRows, headerRowIndex, mappings) {
  const normalizedRecords = [];
  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (row is empty) continue;
    const studentData = { studentName: '', fatherName: '', ... };
    row.forEach((cellVal, colIdx) => {
      const scores = classifyCell(cellVal);
      const mappedField = mappings[colIdx]?.mappedField;
      const assignedField = decide best field from scores and mappedField;
      if (assignedField) studentData[assignedField] = String(cellVal).trim();
    });
    studentData.gender = normalizeGender(studentData.gender);
    studentData.dateOfBirth = normalizeDateOfBirth(studentData.dateOfBirth);
    normalizedRecords.push(studentData);
  }
  return normalizedRecords;
}
```

### 5. Clean the values

Helpers like these make values consistent:

```ts
export function normalizeGender(val) {
  if (!val) return '';
  const str = String(val).trim().toLowerCase();
  if (/^(m|male|boy)$/i.test(str)) return 'Male';
  if (/^(f|female|girl)$/i.test(str)) return 'Female';
  return '';
}

export function normalizeFeeStatus(val) {
  const str = String(val).trim().toLowerCase();
  if (str.includes('paid')) return 'Paid';
  if (str.includes('due') || str.includes('unpaid')) return 'Due';
  return '';
}
```

These functions together keep the data organized and clean by mapping columns, checking values, and normalizing each field.

## Important parts of the project

### 1. Upload and preview

The user chooses a file and the app shows the parsed result:
- detected header row
- column mapping suggestions
- preview of the cleaned student rows

### 2. Column matching

The app looks at the file headers and compares them to a list of expected field names.
If a column header is not clear, it examines the data inside the column to guess what it contains.

### 3. Row cleanup

For each row of students, the app:
- matches each cell to a student field
- fixes formats like dates and phone numbers
- normalizes names and status values

### 4. Export clean file

When the data is ready, the app creates a new Excel file with the standard columns in the right order.
This makes it easy to use the student data in other programs.

## Simple analogy

Think of this app as a helper who:
- reads a messy register sheet
- understands different wordings for the same meaning
- fills the correct boxes for each student
- prints a new clean sheet that is easy to use

## Why this helps

Many student lists come from different schools and formats.
This tool saves time by automatically organizing the data instead of doing it by hand.
