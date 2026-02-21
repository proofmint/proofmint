/**
 * CSV Parser Utility
 * 
 * Parses CSV files for bulk certificate issuance.
 * Validates required columns and email formats.
 */

import { parse } from 'csv-parse/sync';
import { RecipientData } from '../types/certificate';
import { isValidEmail } from '../validators';

/**
 * Parses a CSV file and extracts recipient data
 * 
 * @param csvContent - CSV file content as string
 * @returns Array of recipient data objects
 * @throws Error if CSV is invalid or missing required columns
 */
export async function parseCSV(csvContent: string): Promise<RecipientData[]> {
  // Validate input
  if (!csvContent || csvContent.trim().length === 0) {
    throw new Error('CSV content is empty');
  }

  let records: Record<string, string>[];
  
  try {
    // Parse CSV with headers
    records = parse(csvContent, {
      columns: true, // Use first row as column names
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handle UTF-8 BOM if present
    });
  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate we have records
  if (!records || records.length === 0) {
    throw new Error('CSV file contains no data rows');
  }

  // Validate required "email" column exists
  const firstRecord = records[0];
  if (!('email' in firstRecord)) {
    const availableColumns = Object.keys(firstRecord).join(', ');
    throw new Error(
      `CSV file is missing required "email" column. Available columns: ${availableColumns || 'none'}`
    );
  }

  // Process each record
  const recipientData: RecipientData[] = [];
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rowNumber = i + 2; // +2 because: +1 for 1-based indexing, +1 for header row

    // Extract and validate email
    const email = record.email?.trim();
    if (!email) {
      errors.push(`Row ${rowNumber}: Email is required but was empty`);
      continue;
    }

    if (!isValidEmail(email)) {
      errors.push(`Row ${rowNumber}: Invalid email format: "${email}"`);
      continue;
    }

    // Extract field data from remaining columns
    const fieldData: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      // Skip the email column as it's stored separately
      if (key === 'email') {
        continue;
      }
      
      // Store all other columns as field data
      fieldData[key] = value?.trim() || '';
    }

    recipientData.push({
      email,
      fieldData,
    });
  }

  // If we have errors, throw with all error messages
  if (errors.length > 0) {
    throw new Error(`CSV validation failed:\n${errors.join('\n')}`);
  }

  // Ensure we have at least one valid recipient
  if (recipientData.length === 0) {
    throw new Error('CSV file contains no valid recipients');
  }

  return recipientData;
}
