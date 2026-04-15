import { useState, useCallback } from 'react';
import { useAnalysisData } from '@context/AnalysisContext';
import { generateReport } from '../utils/reportFormatter';

export function useExportReport() {
    const { data } = useAnalysisData();
    const [isExporting, setIsExporting] = useState(false);
    const [exported, setExported] = useState(false);

    const exportReport = useCallback(() => {
        if (!data) return;

        setIsExporting(true);
        try {
            const content = generateReport(data);
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
            const filename = `Analysis_${timestamp}.txt`;

            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);

            setExported(true);
            setTimeout(() => setExported(false), 2000);
        } finally {
            setIsExporting(false);
        }
    }, [data]);

    return { exportReport, isExporting, exported, hasData: !!data };
}
