import { jsPDF } from 'jspdf';
import { getInterviewSummary, getQuestionReviewRows } from './interviewReportData';
import { getFriendlyVisualCards, qualitativeLabel } from './visualReport';

const PAGE = { w: 210, h: 297, m: 12 };
const C = {
  header: [235, 245, 255],
  primary: [37, 99, 235],
  ink: [30, 41, 59],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  card: [248, 250, 252],
  white: [255, 255, 255],
  green: [22, 163, 74],
  greenBg: [220, 252, 231],
  red: [220, 38, 38],
  redBg: [254, 226, 226],
  orange: [234, 88, 12],
  orangeBg: [255, 237, 213],
  blue: [37, 99, 235],
  blueBg: [239, 246, 255],
  purple: [124, 58, 237],
};

function rgb(doc, color) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function fill(doc, color) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function stroke(doc, color) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function wrap(doc, text, width) {
  return doc.splitTextToSize(String(text || '').replace(/\s+/g, ' ').trim() || '—', width);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(value)} • ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

function gradeFromScore(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function resultColors(evaluation) {
  const key = String(evaluation || '').toLowerCase();
  if (key === 'correct') return { fg: C.green, bg: C.greenBg };
  if (key === 'partially_correct') return { fg: C.orange, bg: C.orangeBg };
  if (key === 'incorrect') return { fg: C.red, bg: C.redBg };
  if (key === 'ungraded') return { fg: [71, 85, 105], bg: [241, 245, 249] };
  return { fg: C.muted, bg: C.card };
}

function badgeColors(status) {
  if (status === 'Excellent' || status === 'Good') return { fg: C.green, bg: C.greenBg };
  if (status === 'Moderate' || status === 'Fair') return { fg: C.orange, bg: C.orangeBg };
  return { fg: C.red, bg: C.redBg };
}

function drawHeader(doc, interviewDate) {
  fill(doc, C.header);
  doc.rect(0, 0, PAGE.w, 22, 'F');
  fill(doc, C.primary);
  doc.roundedRect(PAGE.m, 6, 8, 8, 1.6, 1.6, 'F');
  rgb(doc, C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('I', PAGE.m + 4, 11.4, { align: 'center' });
  rgb(doc, C.ink);
  doc.setFontSize(13);
  doc.text('InterviewIQ', PAGE.m + 11, 9.4);
  rgb(doc, C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('AI Interview Report', PAGE.m + 11, 13.6);
  rgb(doc, C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Your performance summary and detailed analysis', PAGE.w / 2 + 8, 9.6);
  rgb(doc, C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Interview Date  ${interviewDate}`, PAGE.w - PAGE.m, 13.6, { align: 'right' });
}

function drawFooter(doc, page, total) {
  const y = PAGE.h - 8;
  stroke(doc, C.line);
  doc.setLineWidth(0.25);
  doc.line(PAGE.m, y - 3.5, PAGE.w - PAGE.m, y - 3.5);
  rgb(doc, C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('InterviewIQ', PAGE.m, y);
  doc.text(`Page ${page} of ${total}`, PAGE.w - PAGE.m, y, { align: 'right' });
}

function drawBar(doc, x, y, width, score, color) {
  fill(doc, C.line);
  doc.roundedRect(x, y, width, 3.4, 1.5, 1.5, 'F');
  const filled = Math.max(1.5, (width * Math.min(100, Math.max(0, score))) / 100);
  fill(doc, color);
  doc.roundedRect(x, y, filled, 3.4, 1.5, 1.5, 'F');
}

function ensureSpace(doc, y, needed, pager, interviewDate) {
  if (y + needed < PAGE.h - 14) return y;
  doc.addPage();
  pager.page += 1;
  drawHeader(doc, interviewDate);
  return 28;
}

function drawScoreRing(doc, cx, cy, radius, score) {
  stroke(doc, C.line);
  doc.setLineWidth(2.2);
  doc.circle(cx, cy, radius, 'S');
  const color = score >= 70 ? C.green : score >= 55 ? C.orange : C.red;
  stroke(doc, color);
  doc.setLineWidth(2.4);
  const start = -Math.PI / 2;
  const end = start + (Math.min(100, Math.max(0, score)) / 100) * Math.PI * 2;
  const steps = 48;
  for (let i = 0; i < steps; i += 1) {
    const a0 = start + ((end - start) * i) / steps;
    const a1 = start + ((end - start) * (i + 1)) / steps;
    doc.line(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius);
  }
  rgb(doc, C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${Math.round(score)}`, cx, cy + 0.4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  rgb(doc, C.muted);
  doc.text('/100', cx, cy + 4.4, { align: 'center' });
  return color;
}

function card(doc, x, y, w, h) {
  fill(doc, C.white);
  stroke(doc, C.line);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2.4, 2.4, 'FD');
}

function sectionTitle(doc, x, y, title) {
  rgb(doc, C.primary);
  doc.circle(x + 1.4, y - 1.1, 1.4, 'F');
  rgb(doc, C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title, x + 5, y);
}

export function buildInterviewReportPdf({ user, interview, results }) {
  if (!results && !interview) return null;
  const reviewRows = getQuestionReviewRows(results, interview);
  const interviewSummary = getInterviewSummary(results, interview);
  const gradingReady = interviewSummary.hasAnswerGrading === true;
  const overall = gradingReady ? Number(interviewSummary.overallScore ?? 0) : 0;
  const visual = results?.visualAnalysis || {};
  const visualCards = getFriendlyVisualCards(visual);
  const overallLabel = gradingReady ? qualitativeLabel(overall) : 'Not auto-graded';
  const interviewDate = formatDateTime(interview?.createdAt || results?.createdAt);
  const endNote = results?.endReason
    ? `${results.endMessage || 'Interview ended.'}${results.endReason === 'ENDED_EARLY' ? ' (Ended early)' : ''}`
    : '';
  const skills = [
    {
      name: 'Visual Confidence',
      score: Number(results?.confidenceScore || 0),
      color: C.blue,
      applicable: interviewSummary.hasVisualConfidence !== false && visual.available !== false,
    },
    { name: 'Communication', score: Number(interviewSummary.communicationScore ?? results?.communicationScore ?? 0), color: C.green, applicable: true },
    { name: 'Technical', score: Number(interviewSummary.technicalScore || 0), color: C.purple, applicable: interviewSummary.hasTechnical === true },
    {
      name: 'Problem Solving',
      score: Number(results?.problemSolvingScore || 0),
      color: C.orange,
      applicable: interviewSummary.hasProblemSolving === true,
    },
  ];

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pager = { page: 1 };
  drawHeader(doc, interviewDate);

  const inner = PAGE.w - PAGE.m * 2;
  let y = 26;
  if (endNote) {
    fill(doc, C.blueBg);
    doc.roundedRect(PAGE.m, y, inner, 8, 1.6, 1.6, 'F');
    rgb(doc, C.primary);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(endNote, PAGE.m + 3, y + 5, { maxWidth: inner - 6 });
    y += 11;
  }

  const gap = 3.5;
  const cardW = (inner - gap * 2) / 3;
  const visX = PAGE.m + cardW + gap;
  const visualPad = 4;
  const visualInner = cardW - visualPad * 2;
  let visualBodyH = 10;
  const visualRows = visualCards.available
    ? visualCards.cards.map((item) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        const badgeText = String(item.status || '');
        const badgeW = Math.min(visualInner * 0.45, Math.max(16, doc.getTextWidth(badgeText) + 3.2));
        const labelW = Math.max(16, visualInner - badgeW - 2.5);
        doc.setFontSize(7);
        const labelLines = wrap(doc, item.label, labelW);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        const descLines = wrap(doc, `${item.value || ''}  ${item.explanation || ''}`.trim(), visualInner);
        const rowH = Math.max(10.5, labelLines.length * 3.15 + descLines.length * 2.7 + 1.8);
        visualBodyH += rowH;
        return { item, badgeText, badgeW, labelLines, descLines, rowH };
      })
    : [];
  const topH = Math.max(62, visualCards.available ? visualBodyH + 8 : 62);
  y = ensureSpace(doc, y, topH + 4, pager, interviewDate);

  card(doc, PAGE.m, y, cardW, topH);
  sectionTitle(doc, PAGE.m + 3, y + 6, 'Interview Summary');
  const summaryPairs = [
    ['Questions Asked', interviewSummary.questionsAsked],
    ['Questions Answered', interviewSummary.questionsAnswered],
    ['Unanswered', interviewSummary.unanswered],
    ['Correct', interviewSummary.correct],
    ['Partially Correct', interviewSummary.partiallyCorrect],
    ['Incorrect', interviewSummary.incorrect],
  ];
  summaryPairs.forEach((pair, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const sx = PAGE.m + 4 + col * (cardW / 2);
    const sy = y + 13 + row * 10;
    rgb(doc, C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(pair[0], sx, sy);
    const key = pair[0];
    rgb(doc, key === 'Correct' ? C.green : key === 'Partially Correct' ? C.orange : key === 'Incorrect' ? C.red : C.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(String(pair[1] ?? 0), sx, sy + 5);
  });
  rgb(doc, C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(
    gradingReady
      ? `Accuracy ${interviewSummary.accuracyPercent ?? 0}%  •  ${interviewSummary.totalMarks ?? 0}/${interviewSummary.maxMarks ?? 0} marks`
      : `Not auto-graded: ${interviewSummary.ungraded ?? 0}  •  Marks unavailable`,
    PAGE.m + 4,
    y + topH - 4,
    { maxWidth: cardW - 8 }
  );

  card(doc, visX, y, cardW, topH);
  sectionTitle(doc, visX + 3, y + 6, 'Visual Analysis (MediaPipe)');
  if (visualCards.available) {
    let sy = y + 12;
    visualRows.forEach((row) => {
      const colors = badgeColors(row.item.status);
      const badgeX = visX + cardW - visualPad - row.badgeW;
      fill(doc, colors.bg);
      doc.roundedRect(badgeX, sy - 3.1, row.badgeW, 5, 1.3, 1.3, 'F');
      rgb(doc, colors.fg);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.text(row.badgeText, badgeX + row.badgeW / 2, sy, { align: 'center', maxWidth: row.badgeW - 1.2 });
      rgb(doc, C.ink);
      doc.setFontSize(7);
      row.labelLines.forEach((line, lineIndex) => {
        doc.text(line, visX + visualPad, sy + lineIndex * 3.15, { maxWidth: visualInner - row.badgeW - 2.5 });
      });
      rgb(doc, C.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      const descY = sy + row.labelLines.length * 3.15 + 0.4;
      row.descLines.forEach((line, lineIndex) => {
        doc.text(line, visX + visualPad, descY + lineIndex * 2.7, { maxWidth: visualInner });
      });
      sy += row.rowH;
    });
  } else {
    rgb(doc, C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Camera visual analysis was not recorded for this session.', visX + 4, y + 16, {
      maxWidth: cardW - 8,
    });
  }

  const ovX = visX + cardW + gap;
  card(doc, ovX, y, cardW, topH);
  sectionTitle(doc, ovX + 3, y + 6, 'Overall Result');
  if (gradingReady) {
    drawScoreRing(doc, ovX + cardW / 2, y + 24, 10, overall);
    const statusColor = overall >= 55 ? C.green : C.red;
    fill(doc, overall >= 55 ? C.greenBg : C.redBg);
    doc.roundedRect(ovX + cardW / 2 - 12, y + 37, 24, 6, 1.5, 1.5, 'F');
    rgb(doc, statusColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(overall >= 55 ? 'Pass' : 'Fail', ovX + cardW / 2, y + 41, { align: 'center' });
    rgb(doc, C.ink);
    doc.setFontSize(8);
    doc.text(`${overallLabel}  •  Grade ${gradeFromScore(overall)}`, ovX + cardW / 2, y + 49, { align: 'center' });
  } else {
    rgb(doc, C.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('N/A', ovX + cardW / 2, y + 28, { align: 'center' });
    fill(doc, C.card);
    doc.roundedRect(ovX + cardW / 2 - 18, y + 34, 36, 6, 1.5, 1.5, 'F');
    rgb(doc, C.ink);
    doc.setFontSize(7);
    doc.text('Not auto-graded', ovX + cardW / 2, y + 38, { align: 'center' });
  }
  rgb(doc, C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(
    interviewSummary.strengths || interviewSummary.weaknesses || 'Overall score is marks obtained divided by maximum marks for questions that were asked.',
    ovX + 4,
    y + topH - 6,
    { maxWidth: cardW - 8 }
  );

  y += topH + 8;
  y = ensureSpace(doc, y, 58, pager, interviewDate);
  const leftW = 118;
  const rightW = inner - leftW - gap;
  const blockH = 56;
  card(doc, PAGE.m, y, leftW, blockH);
  sectionTitle(doc, PAGE.m + 3, y + 6, 'Performance Overview');
  skills.forEach((skill, index) => {
    const sy = y + 14 + index * 10;
    fill(doc, skill.color);
    doc.circle(PAGE.m + 6, sy, 1.4, 'F');
    rgb(doc, C.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(skill.name, PAGE.m + 10, sy + 0.8);
    const display = skill.applicable ? `${skill.score}/100 (${skill.score}%)` : 'Not applicable';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    rgb(doc, C.muted);
    doc.text(display, PAGE.m + leftW - 4, sy + 0.8, { align: 'right' });
    drawBar(doc, PAGE.m + 10, sy + 2.6, leftW - 16, skill.applicable ? skill.score : 0, skill.color);
  });

  card(doc, PAGE.m + leftW + gap, y, rightW, blockH);
  sectionTitle(doc, PAGE.m + leftW + gap + 3, y + 6, 'Skill Breakdown');
  skills.forEach((skill, index) => {
    const sy = y + 16 + index * 8;
    fill(doc, skill.color);
    doc.circle(PAGE.m + leftW + gap + 6, sy, 1.3, 'F');
    rgb(doc, C.ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const value = skill.applicable ? `${skill.score}/100` : 'N/A';
    doc.text(`${skill.name}: ${value}`, PAGE.m + leftW + gap + 10, sy + 1);
  });
  rgb(doc, C.muted);
  doc.setFontSize(6.2);
  doc.text(
    'Each skill is scored independently based on your actual performance. Visual confidence is separate from answer marks.',
    PAGE.m + leftW + gap + 4,
    y + blockH - 6,
    { maxWidth: rightW - 8 }
  );

  y += blockH + 8;
  y = ensureSpace(doc, y, 20, pager, interviewDate);
  rgb(doc, C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Question-wise Evaluation', PAGE.m, y);
  y += 3;
  rgb(doc, C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Only questions that were actually asked are shown.', PAGE.m, y);
  y += 5;

  if (!reviewRows.length) {
    rgb(doc, C.muted);
    doc.setFontSize(9);
    doc.text('No questions or answers were saved for this interview.', PAGE.m, y);
  }

  reviewRows.forEach((row) => {
    const contentW = inner - 8;
    const colors = resultColors(row.evaluation);
    const blocks = [
      { title: `Q${row.questionNumber}. ${row.question}`, size: 8, bold: true },
      { title: `Your answer: ${row.candidateAnswer || 'Unanswered'}`, size: 7.4, bold: false },
      { title: `What was missing / wrong: ${row.mistake || '—'}`, size: 7.2, bold: false },
      { title: `Ideal answer: ${row.idealAnswer || '—'}`, size: 7.2, bold: false },
      { title: `Feedback: ${row.feedback || '—'}`, size: 7.2, bold: false },
    ].map((block) => {
      doc.setFontSize(block.size);
      return { ...block, lines: wrap(doc, block.title, contentW) };
    });
    const boxH = 12 + blocks.reduce((sum, block) => sum + block.lines.length * 3.6, 0);
    y = ensureSpace(doc, y, Math.min(boxH, 70), pager, interviewDate);
    card(doc, PAGE.m, y, inner, boxH);
    fill(doc, colors.bg);
    doc.roundedRect(PAGE.m + inner - 46, y + 3, 22, 5.4, 1.4, 1.4, 'F');
    rgb(doc, colors.fg);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(row.resultLabel, PAGE.m + inner - 35, y + 6.6, { align: 'center' });
    rgb(doc, C.ink);
    doc.setFontSize(8);
    doc.text(row.scored ? `${row.score}/${row.maxScore}` : '—', PAGE.m + inner - 8, y + 6.6, { align: 'right' });
    let cy = y + 12;
    blocks.forEach((block) => {
      doc.setFont('helvetica', block.bold ? 'bold' : 'normal');
      doc.setFontSize(block.size);
      rgb(doc, C.ink);
      block.lines.forEach((line) => {
        if (cy > PAGE.h - 16) {
          y = ensureSpace(doc, cy, 18, pager, interviewDate);
          cy = y;
        }
        doc.text(line, PAGE.m + 4, cy);
        cy += 3.6;
      });
      cy += 0.8;
    });
    y += boxH + 3.5;
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }
  const id = interview?.id || interview?._id || 'session';
  const filename = `interview-report-${id}.pdf`;
  return { doc, filename };
}

export function downloadInterviewReportPdf(options) {
  const built = buildInterviewReportPdf(options);
  if (!built) return;
  built.doc.save(built.filename);
}

export async function getInterviewReportPdfFile(options) {
  const built = buildInterviewReportPdf(options);
  if (!built) return null;
  const blob = built.doc.output('blob');
  const file = new File([blob], built.filename, { type: 'application/pdf' });
  return { file, blob, filename: built.filename };
}

export default downloadInterviewReportPdf;
