type CsvValue = string | number | boolean | null | undefined;

const escapeCsvValue = (value: CsvValue) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const downloadCsv = (rows: Record<string, CsvValue>[], filename: string) => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
        headers.map(escapeCsvValue).join(','),
        ...rows.map(row => headers.map(header => escapeCsvValue(row[header])).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const parseCsvText = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && inQuotes && next === '"') {
            cell += '"';
            i += 1;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            row.push(cell);
            cell = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') i += 1;
            row.push(cell);
            if (row.some(value => value.trim() !== '')) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }

    row.push(cell);
    if (row.some(value => value.trim() !== '')) rows.push(row);
    return rows;
};

export const readCsvFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Only CSV files are supported for secure import.');
    }
    return parseCsvText(await file.text());
};
