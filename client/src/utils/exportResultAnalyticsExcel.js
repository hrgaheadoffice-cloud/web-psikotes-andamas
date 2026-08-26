import * as XLSX from 'xlsx';
import { api } from './api';

const DEFAULT_TITLE = 'All Participants';

const formatFilterSummary = (filters) =>
  Object.keys(filters || {}).length
    ? Object.entries(filters)
        .filter(([, value]) => value !== '' && value != null)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ')
    : DEFAULT_TITLE;

const worksheetFromRows = (titleRows, rows) => {
  const sheet = XLSX.utils.aoa_to_sheet([...titleRows, ...rows]);
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  sheet['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 16 }];
  return sheet;
};

const asPercentage = (value) => {
  if (value == null || value === '') return '-';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return `${numeric.toFixed(2)}%`;
};

const asNumber = (value, digits = 2) => {
  if (value == null || value === '') return '-';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return Number.isInteger(numeric) ? numeric : numeric.toFixed(digits);
};

const asCount = (value) => {
  if (value == null || value === '') return '-';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return Math.round(numeric);
};

const sumDistribution = (items) =>
  (Array.isArray(items) ? items : []).reduce((sum, item) => sum + Number(item?.value || 0), 0);

const withPercentageRows = (items, denominator, valueLabel = 'Peserta') => {
  const header = ['Name', valueLabel, 'Persentase'];
  const rows = (Array.isArray(items) ? items : []).map((item) => {
    const count = Number(item?.value || 0);
    const percentage = denominator > 0 ? `${((count / denominator) * 100).toFixed(2)}%` : '-';
    return [item?.name ?? '-', asCount(count), percentage];
  });
  return [header, ...rows];
};

const assessmentOverviewRows = (rows) => {
  const header = ['Test', 'Peserta', 'Selesai', 'Completion'];
  const body = (Array.isArray(rows) ? rows : []).map((row) => [
    row?.name ?? '-',
    asCount(row?.participants),
    asCount(row?.completed),
    row?.completion == null ? '-' : asPercentage(row.completion),
  ]);
  return [header, ...body];
};

const buildHeaderRows = (filters) => ([
  ['ANDAMAS GROUP', ''],
  ['RESULT ANALYTICS', ''],
  ['Psikotes & Recruitment Assessment', ''],
  ['Generated:', new Date().toLocaleString('id-ID')],
  ['Filter:', formatFilterSummary(filters)],
  [''],
]);

const buildKpiRows = (summary) => ([
  ['Metric', 'Value'],
  ['Total Peserta', summary?.total_participants ?? '-'],
  [
    'Penyelesaian Psikotes',
    summary?.completion?.completed == null || summary?.completion?.total == null
      ? summary?.completion?.percentage == null
        ? '-'
        : asPercentage(summary.completion.percentage)
      : `${asCount(summary.completion.completed)} / ${asCount(summary.completion.total)} Peserta\n${asPercentage(summary?.completion?.percentage)}`,
  ],
  ['Rata-rata IQ CFIT', asNumber(summary?.iq_cfit?.average)],
  ['Rata-rata IQ WPT', asNumber(summary?.iq_wpt?.average)],
  ['Rata-rata Speed Test', asNumber(summary?.speed?.average)],
  ['Rata-rata Memory Test', asNumber(summary?.memory?.average)],
  ['Risiko Rekrutmen', summary?.cbi?.dominant_level ? `${summary.cbi.dominant_level} Level` : '-'],
]);

const tableRowsFromDistribution = (items, valueLabel = 'Peserta', includePercentage = false) => {
  const header = ['Name', valueLabel];
  if (includePercentage) header.push('Persentase');
  const rows = (Array.isArray(items) ? items : []).map((item) => {
    const row = [item.name ?? '-', item.value ?? 0];
    if (includePercentage) row.push(item.percentage == null ? '-' : asPercentage(item.percentage));
    return row;
  });
  return [header, ...rows];
};

export async function exportResultAnalyticsExcel(filters = {}) {
  const endpointParams = filters || {};
  const [
    summaryRes,
    genderRes,
    ageRes,
    educationRes,
    departmentRes,
    positionRes,
    businessUnitRes,
    discRes,
    temperamentRes,
    cfitRes,
    wptRes,
    assessmentRes,
    speedRes,
    memoryRes,
    cbiRes,
    papikostickRes,
  ] = await Promise.all([
    api.get('/analytics/executive-summary', { params: endpointParams }),
    api.get('/analytics/overview/gender', { params: endpointParams }),
    api.get('/analytics/overview/age', { params: endpointParams }),
    api.get('/analytics/overview/education', { params: endpointParams }),
    api.get('/analytics/overview/department', { params: endpointParams }),
    api.get('/analytics/overview/position', { params: endpointParams }),
    api.get('/analytics/overview/business_unit', { params: endpointParams }),
    api.get('/analytics/personality/disc', { params: endpointParams }),
    api.get('/analytics/personality/temperament', { params: endpointParams }),
    api.get('/analytics/personality/iq-cfit', { params: endpointParams }),
    api.get('/analytics/personality/iq-wpt', { params: endpointParams }),
    api.get('/analytics/assessment-overview', { params: endpointParams }),
    api.get('/analytics/recruitment/speed', { params: endpointParams }),
    api.get('/analytics/recruitment/memory', { params: endpointParams }),
    api.get('/analytics/recruitment/cbi', { params: endpointParams }),
    api.get('/analytics/recruitment/papikostick', { params: endpointParams }),
  ]);

  const workbook = XLSX.utils.book_new();

  const summarySheet = worksheetFromRows(buildHeaderRows(filters), buildKpiRows(summaryRes.data));
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');

  const participantSheetRows = [
    ['ANDAMAS GROUP', ''],
    ['Participant Analytics', ''],
    [''],
    ['Gender Distribution', ''],
    ...tableRowsFromDistribution(genderRes.data, 'Peserta', true),
    [''],
    ['Age Distribution', ''],
    ...tableRowsFromDistribution(ageRes.data, 'Peserta', false),
    [''],
    ['Education Distribution', ''],
    ...tableRowsFromDistribution(educationRes.data, 'Peserta', false),
  ];
  const participantSheet = worksheetFromRows([], participantSheetRows);
  participantSheet['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, participantSheet, 'Participant Analytics');

  const orgSheetRows = [
    ['ANDAMAS GROUP', ''],
    ['Organization Analytics', ''],
    [''],
    ['Department', ''],
    ...tableRowsFromDistribution(departmentRes.data, 'Peserta', false),
    [''],
    ['Position', ''],
    ...tableRowsFromDistribution(positionRes.data, 'Peserta', false),
    [''],
    ['Business Unit', ''],
    ...tableRowsFromDistribution(businessUnitRes.data, 'Peserta', true),
  ];
  const orgSheet = worksheetFromRows([], orgSheetRows);
  orgSheet['!cols'] = [{ wch: 34 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, orgSheet, 'Organization Analytics');

  const personalitySheetRows = [
    ['ANDAMAS GROUP', ''],
    ['Personality Recruitment', ''],
    [''],
    ['DISC', ''],
    ...withPercentageRows(discRes.data?.distribution, discRes.data?.total ?? sumDistribution(discRes.data?.distribution)),
    [''],
    ['Temperament', ''],
    ...withPercentageRows(temperamentRes.data?.distribution, temperamentRes.data?.total ?? sumDistribution(temperamentRes.data?.distribution)),
    [''],
    ['IQ CFIT', ''],
    ...withPercentageRows(cfitRes.data?.distribution, sumDistribution(cfitRes.data?.distribution)),
    [''],
    ['IQ WPT', ''],
    ...withPercentageRows(wptRes.data?.distribution, sumDistribution(wptRes.data?.distribution)),
    [''],
    ['Recruitment Analytics', ''],
    ['Assessment Overview', ''],
    ...assessmentOverviewRows(assessmentRes.data),
    [''],
    ['Speed Test', ''],
    ['Metric', 'Value'],
    ['Total Peserta', asCount(speedRes.data?.total)],
    ['Rata-rata Score', asNumber(speedRes.data?.average_score)],
    [''],
    ['Memory Test', ''],
    ['Metric', 'Value'],
    ['Total Peserta', asCount(memoryRes.data?.total)],
    ['Rata-rata Score', asNumber(memoryRes.data?.average_score)],
    [''],
    ['CBI Risk Distribution', ''],
    ['CBI Category', 'Peserta', 'Persentase'],
    ...(Array.isArray(cbiRes.data?.distribution)
      ? cbiRes.data.distribution.flatMap((dimension) => {
          const total = dimension?.levels?.reduce((sum, level) => sum + Number(level?.value || 0), 0) || 0;
          return (dimension?.levels || []).map((level) => [
            `${dimension?.name ?? '-'} - ${level?.name ?? '-'}`,
            asCount(level?.value),
            total > 0 ? `${((Number(level?.value || 0) / total) * 100).toFixed(2)}%` : '-',
          ]);
        })
      : [['-', '-', '-']]),
    [''],
    ['PAPIKOSTICK', ''],
    ...withPercentageRows(papikostickRes.data?.distribution, papikostickRes.data?.total ?? sumDistribution(papikostickRes.data?.distribution)),
  ];
  const personalitySheet = worksheetFromRows([], personalitySheetRows);
  personalitySheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, personalitySheet, 'Personality Recruitment');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Andamas-Result-Analytics-${today}.xlsx`);
}
