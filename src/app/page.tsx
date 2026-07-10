'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { FIELD_DEFINITIONS } from '@/utils/normalizer';
import {
  FileProcessingResponse,
  ColumnMappingInfo,
  SchemaField,
  SheetProcessingResult
} from '@/types/normalization';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [response, setResponse] = useState<FileProcessingResponse | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [updatingMapping, setUpdatingMapping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showOriginalData, setShowOriginalData] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadSampleFile = () => {
    const data1 = [
      ["Greenfield Public School Student Registry"],
      ["Academic Year 2025-2026"],
      [],
      ["Full Name", "Father's Name", "Mother", "Roll #", "Admission ID", "Grade", "Sec", "DOB", "Gender", "Mobile", "Address", "Status", "Irrelevant Column 1"],
      ["John Doe", "Robert Doe", "Jane Doe", "Roll-1", "ADM101", "10-A", "", "15/08/2012", "M", "9876543210", "123 Main St", "Fee Paid", "Random data"],
      ["Alice Smith", "Thomas Smith", "", "2", "ADM102", "Class 8 Section B", "", "2013-05-10", "Female", "+1 555-0199", "456 Pine Rd", "Due", "More junk"],
      ["Bob Johnson", "", "Mary Johnson", "3", "", "Grade 5", "C", "12-11-2014", "Boy", "555 1234", "789 Oak Ave", "Paid", "Junk"],
      ["Emma Watson", "David Watson", "", "", "ADM104", "7B", "", "23.09.2012", "Girl", "", "", "Fees Paid", "Junk"],
      ["Liam Brown", "James Brown", "Sarah Brown", "5", "ADM105", "Class 9", "A", "05/12/2011", "male", "9998887776", "321 Elm St", "Paid", "Draft"]
    ];

    const data2 = [
      ["Peter Parker", "ADM991", "Class 11 A", "Boy", "5550144", "Paid"],
      ["Bruce Wayne", "ADM992", "12-B", "M", "5550199", "Paid"],
      ["Clark Kent", "ADM993", "Grade 10 C", "Male", "5550188", "Due"],
      ["Diana Prince", "ADM994", "Grade 12", "Female", "5550177", "Paid"]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(data1);
    const ws2 = XLSX.utils.aoa_to_sheet(data2);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Messy Student List");
    XLSX.utils.book_append_sheet(wb, ws2, "Headerless & Scattered");
    
    XLSX.writeFile(wb, "messy_students_sample.xlsx");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    setError(null);
    setResponse(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('/api/normalize', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to process spreadsheet file');
      }

      const data: FileProcessingResponse = await res.json();
      setResponse(data);
      setActiveSheetIndex(0);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while uploading and parsing the file.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.csv'))) {
      await processFile(droppedFile);
    } else {
      setError('Please upload a valid Excel (.xlsx) or CSV (.csv) file.');
    }
  };

  const handleMappingChange = async (sheetIdx: number, colIdx: number, newField: SchemaField | '') => {
    if (!response) return;

    setUpdatingMapping(true);
    try {
      const sheet = response.sheets[sheetIdx];

      // Update mapping
      const updatedMappings = sheet.columnMappings.map((m, idx) => {
        if (idx === colIdx) {
          return {
            ...m,
            mappedField: newField ? newField : null,
            confidence: newField ? 1.0 : 0
          };
        }
        return m;
      });

      // POST mapping change to API
      const res = await fetch('/api/normalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rawRows: sheet.rawRows,
          headerRowIndex: sheet.headerRowIndex,
          mappings: updatedMappings
        })
      });

      if (!res.ok) {
        throw new Error('Failed to update column mapping');
      }

      const data = await res.json();

      const updatedSheets = [...response.sheets];
      updatedSheets[sheetIdx] = {
        ...sheet,
        columnMappings: updatedMappings,
        allRecords: data.records,
        previewRecords: data.records.slice(0, 10),
        processedRowCount: data.processedRowCount,
        missingFieldsCount: data.missingFieldsCount
      };

      setResponse({
        ...response,
        sheets: updatedSheets
      });
    } catch (err: any) {
      setError(err.message || 'Error updating mappings.');
    } finally {
      setUpdatingMapping(false);
    }
  };

  const handleDownload = async (records: any[], label: string, filePrefix: string) => {
    if (!response) return;

    const sheet = response.sheets[activeSheetIndex];
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records,
          sheetName: sheet.sheetName,
          fileNamePrefix: `${filePrefix}_${response.fileName.replace(/\.[^/.]+$/, "")}`
        })
      });

      if (!res.ok) {
        throw new Error('Failed to export clean Excel file');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filePrefix}_${sheet.sheetName}_${response.fileName.replace(/\.[^/.]+$/, "")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Error exporting clean spreadsheet.');
    }
  };

  const activeSheet = response?.sheets[activeSheetIndex];

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 font-sans antialiased">
      {/* Header Banner */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg font-bold text-lg tracking-wide shadow-md shadow-blue-500/20">
              SDN
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Student Data Normalizer</h1>
              <p className="text-xs text-slate-400">Intelligent Register Normalization & Schema Cleaning</p>
            </div>
          </div>
          <button
            onClick={downloadSampleFile}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-700 hover:border-slate-500 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-all text-xs font-semibold shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download Sample Messy File</span>
          </button>
        </div>
      </header>

      {/* Main Layout container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800/80 text-red-200 rounded-xl flex items-start space-x-3 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Processing Error</h3>
              <p className="text-xs text-red-300 mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* Upload dropzone (Visible when no file is processed) */}
        {!response && (
          <div className="max-w-2xl mx-auto mt-12">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/40 hover:bg-slate-950/80 rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center space-y-6 shadow-xl"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.csv"
                className="hidden"
              />
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-full text-slate-400 group-hover:text-blue-500 group-hover:border-blue-900 group-hover:bg-blue-950/20 transition-all duration-300">
                {loading ? (
                  <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-base font-semibold text-slate-200 group-hover:text-white transition-all">
                  {loading ? 'Processing file...' : 'Upload your student register'}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Drag and drop Excel (.xlsx) or CSV (.csv) file here, or click to browse
                </p>
              </div>
              <div className="flex space-x-6 text-xs text-slate-400 border-t border-slate-900 pt-6 w-full justify-center">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span>Auto-detect headers</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>Fuzzy matching</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span>Class & Section Split</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Workspace */}
        {response && activeSheet && (
          <div className="space-y-8 animate-fadeIn">
            {/* File info bar and Sheet Tabs */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-600/15 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">{response.fileName}</h2>
                  <p className="text-xs text-slate-500">Choose sheet tab below to verify and clean</p>
                </div>
              </div>

              {/* Sheet selector Tabs */}
              {response.sheets.length > 1 && (
                <div className="flex flex-wrap gap-2 border-l border-slate-850 pl-0 md:pl-4">
                  {response.sheets.map((sheet, idx) => (
                    <button
                      key={sheet.sheetName}
                      onClick={() => setActiveSheetIndex(idx)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        activeSheetIndex === idx
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {sheet.sheetName} ({sheet.processedRowCount} rows)
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setFile(null);
                    setResponse(null);
                  }}
                  className="px-3 py-1.5 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-900 transition-all"
                >
                  Reset File
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleDownload(activeSheet.completedRecords, 'completed', 'completed')}
                    disabled={updatingMapping || activeSheet.completedRecords.length === 0}
                    className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-500/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Export Completed</span>
                  </button>
                  <button
                    onClick={() => handleDownload(activeSheet.needsReviewRecords, 'review', 'needs_review')}
                    disabled={updatingMapping || activeSheet.needsReviewRecords.length === 0}
                    className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md shadow-amber-600/10 hover:shadow-amber-500/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Export Review</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Statistics Dashboard Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Original Row Count</p>
                <div className="flex items-baseline mt-2 space-x-2">
                  <span className="text-2xl font-bold text-slate-200">{activeSheet.originalRowCount}</span>
                  <span className="text-xs text-slate-500">rows detected</span>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Processed Records</p>
                <div className="flex items-baseline mt-2 space-x-2">
                  <span className="text-2xl font-bold text-emerald-400">{activeSheet.processedRowCount}</span>
                  <span className="text-xs text-slate-500">successfully mapped</span>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Missing Field Values</p>
                <div className="flex items-baseline mt-2 space-x-2">
                  <span className={`text-2xl font-bold ${activeSheet.missingFieldsCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {activeSheet.missingFieldsCount}
                  </span>
                  <span className="text-xs text-slate-500">blank in output</span>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mapped Columns</p>
                <div className="flex items-baseline mt-2 space-x-2">
                  <span className="text-2xl font-bold text-blue-400">
                    {activeSheet.columnMappings.filter(m => m.mappedField !== null).length}
                  </span>
                  <span className="text-xs text-slate-500">
                    of {activeSheet.columnMappings.length} columns
                  </span>
                </div>
              </div>
            </div>

            {/* Column Mapping Section */}
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-6 shadow-sm">
              <div className="border-b border-slate-850 pb-4 mb-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Suggested Field Mapping</h3>
                  <p className="text-xs text-slate-500 mt-1">The app already matched your columns using headers and sample values, so most files should not need manual entry.</p>
                </div>
                <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/10 px-3 py-2 text-xs text-emerald-300">
                  Auto-detected: {activeSheet.columnMappings.filter(m => m.mappedField !== null).length} / {activeSheet.columnMappings.length} columns
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSheet.columnMappings.map((mapping, idx) => {
                  const confPct = Math.round(mapping.confidence * 100);
                  const isMapped = mapping.mappedField !== null;
                  const targetField = FIELD_DEFINITIONS.find(def => def.key === mapping.mappedField);
                  const badgeClass = isMapped
                    ? (confPct === 100
                      ? 'bg-emerald-950 border border-emerald-900 text-emerald-400'
                      : 'bg-blue-950 border border-blue-900 text-blue-400')
                    : 'bg-slate-950 border border-slate-800 text-slate-400';

                  return (
                    <div
                      key={`${mapping.detectedHeader}-${idx}`}
                      className={`p-3 rounded-lg border transition-all ${
                        isMapped ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-950/20 border-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-200 truncate max-w-[170px]" title={mapping.detectedHeader}>
                          {mapping.detectedHeader || <span className="italic text-slate-500">Unnamed column</span>}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
                          {isMapped ? (confPct === 100 ? 'Ready' : `${confPct}% match`) : 'Needs review'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400">
                        {isMapped ? (
                          <>
                            Will be used as <span className="font-medium text-slate-200">{targetField?.label || mapping.mappedField}</span>
                          </>
                        ) : (
                          'No confident match yet. It will stay unused for now.'
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Original Data vs Normalized Comparison */}
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-6 shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-850">
                <div>
                  <h3 className="text-sm font-semibold text-white">Upload Comparison</h3>
                  <p className="text-xs text-slate-500 mt-1">View the original uploaded data and how it was normalized.</p>
                </div>
                <button
                  onClick={() => setShowOriginalData(!showOriginalData)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    showOriginalData
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {showOriginalData ? 'Show Normalized' : 'Show Original'}
                </button>
              </div>

              {showOriginalData ? (
                <div className="overflow-x-auto rounded-lg border border-slate-850/70">
                  <table className="w-full text-left text-xs text-slate-300 border-collapse bg-slate-950/50">
                    <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-850 sticky top-0">
                      <tr>
                        {activeSheet.headers.map((header, idx) => (
                          <th key={idx} className="px-3 py-2 border-r border-slate-850 whitespace-nowrap">
                            {header || <span className="italic text-slate-600">Column {idx + 1}</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {activeSheet.rawRows.slice(activeSheet.headerRowIndex + 1, activeSheet.headerRowIndex + 8).map((row, rowIdx) => (
                        <tr key={`orig-${rowIdx}`} className="hover:bg-slate-900/30 transition-colors">
                          {row.map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className="px-3 py-2 border-r border-slate-850 whitespace-nowrap text-slate-300"
                            >
                              {cell !== null && cell !== undefined && String(cell).trim() !== '' ? cell : <span className="text-slate-600 italic">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 text-xs italic">
                  Original data view hidden. Click button above to see uploaded source.
                </div>
              )}
            </div>

            {/* Preview Section */}
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-6 shadow-sm overflow-hidden flex flex-col">
              <div className="border-b border-slate-850 pb-4 mb-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">Normalized Record Overview</h3>
                  <p className="text-xs text-slate-500 mt-1">Records are grouped into completed rows and rows that need review before export.</p>
                </div>
                <div className="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 border border-slate-850 rounded-lg">
                  Total output: <strong className="text-slate-200">{activeSheet.allRecords.length} records</strong>
                </div>
              </div>

              {activeSheet.previewRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs italic">
                  No records processed or mapped. Adjust column mappings above to parse data.
                </div>
              ) : (
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-emerald-300">Completed Records</h4>
                        <p className="text-xs text-emerald-700/90">Clean rows with no blank core fields.</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                        {activeSheet.completedRecordCount}
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-850/70">
                      <table className="w-full text-left text-xs text-slate-300 border-collapse">
                        <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-850 sticky top-0">
                          <tr>
                            {FIELD_DEFINITIONS.map(def => (
                              <th key={def.key} className="px-3 py-2 border-r border-slate-850 whitespace-nowrap">
                                {def.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {activeSheet.completedRecords.slice(0, 5).map((student, rowIdx) => (
                            <tr key={`completed-${rowIdx}`} className="hover:bg-slate-900/50 transition-colors">
                              {FIELD_DEFINITIONS.map(def => (
                                <td
                                  key={def.key}
                                  className="px-3 py-2 border-r border-slate-850 whitespace-nowrap text-slate-300"
                                >
                                  {student[def.key] || '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-amber-300">Needs Review</h4>
                        <p className="text-xs text-amber-700/90">Rows with blank core values that should be checked.</p>
                      </div>
                      <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                        {activeSheet.needsReviewRecordCount}
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-850/70">
                      <table className="w-full text-left text-xs text-slate-300 border-collapse">
                        <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-850 sticky top-0">
                          <tr>
                            {FIELD_DEFINITIONS.map(def => (
                              <th key={def.key} className="px-3 py-2 border-r border-slate-850 whitespace-nowrap">
                                {def.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {activeSheet.needsReviewRecords.slice(0, 5).map((student, rowIdx) => (
                            <tr key={`review-${rowIdx}`} className="hover:bg-slate-900/50 transition-colors">
                              {FIELD_DEFINITIONS.map(def => {
                                const val = student[def.key];
                                const isEmpty = !val;
                                return (
                                  <td
                                    key={def.key}
                                    className={`px-3 py-2 border-r border-slate-850 whitespace-nowrap ${
                                      isEmpty ? 'text-amber-400 italic' : 'text-slate-300'
                                    }`}
                                  >
                                    {isEmpty ? '—' : val}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-850 py-6 mt-12 bg-slate-950/40 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Student Data Normalizer - Built for messy school records cleaning.</p>
          <div className="flex space-x-4">
            <span className="text-slate-650">v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
