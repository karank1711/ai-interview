import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  DocumentArrowDownIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { interviewService } from '../services/interviewService';
import { downloadInterviewReportPdf } from '../utils/interviewReportPdf';
import { readPageCache, writePageCache } from '../utils/pageDataCache';
import { perfLog } from '../utils/perf';
import { getInterviewSummary, getQuestionReviewRows, resultBadgeClass } from '../utils/interviewReportData';
import { getFriendlyVisualCards, qualitativeLabel } from '../utils/visualReport';
import AnimatedCounter from '../components/AnimatedCounter';

const Results = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const cached = readPageCache(`results:${id}`);
  const [results, setResults] = useState(cached?.results || null);
  const [interview, setInterview] = useState(cached?.interview || null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();

    async function fetchResults(attempt = 0) {
      try {
        const [resultsResponse, interviewResponse] = await Promise.all([
          interviewService.getResults(id),
          interviewService.getInterviewById(id),
        ]);
        if (cancelled) return;
        setResults(resultsResponse.data);
        setInterview(interviewResponse.data);
        writePageCache(`results:${id}`, {
          results: resultsResponse.data,
          interview: interviewResponse.data,
        });
        setLoading(false);
        perfLog('results-data', `${Math.round(performance.now() - started)}ms`);
      } catch (error) {
        if (cancelled) return;
        if (attempt < 20) {
          window.setTimeout(() => fetchResults(attempt + 1), 400);
          return;
        }
        console.error('Failed to fetch results:', error);
        if (!readPageCache(`results:${id}`)) navigate('/dashboard');
      }
    }

    fetchResults();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const downloadReport = () => {
    if (!interview || !results) return;
    try {
      downloadInterviewReportPdf({ user, interview, results });
    } catch (error) {
      console.error('Failed to generate PDF report:', error);
    }
  };

  const shareResults = () => {
    // Implement share functionality
    alert('Share feature coming soon!');
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const interviewSummary = getInterviewSummary(results, interview);
  const questionRows = getQuestionReviewRows(results, interview);
  const visual = results?.visualAnalysis;
  const lookingAway =
    visual?.lookingAwayPercent ??
    visual?.engagement?.lookingAwayPercent ??
    (visual?.attentionTowardCameraPercent != null
      ? Math.max(0, 100 - visual.attentionTowardCameraPercent)
      : null);
  const cameraAttentionPercent =
    visual?.attentionTowardCameraPercent ?? visual?.engagement?.facingCameraPercent ?? null;
  const visualCards = getFriendlyVisualCards(visual);
  const gradingReady = interviewSummary.hasAnswerGrading === true;
  const overallScore = gradingReady ? Number(interviewSummary.overallScore ?? 0) : null;
  const overallStatus = gradingReady ? qualitativeLabel(overallScore) : 'Not auto-graded';
  const passed = gradingReady && overallScore >= 55;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070b16] py-8">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Header */}
          {(results?.endMessage || results?.endReason) && (
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
              {results.endMessage || 'Interview completed normally.'}
              {results.endReason === 'ENDED_EARLY' ? ' (Ended early)' : ''}
              {results.endReason === 'CAMERA_OFF' || results.endReason === 'MIC_OFF' || results.endReason === 'CAMERA_AND_MIC_OFF' || results.endReason === 'FACE_NOT_DETECTED' || results.endReason === 'LOOKING_AWAY' ? ' (Auto-ended)' : ''}
            </div>
          )}
          <div className="text-center mb-8">
            <h1 className="mb-2 text-[clamp(1.35rem,5vw,1.875rem)] font-bold text-gray-900 dark:text-white">
              Interview Results
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {interview?.category?.replace('_', ' ')} - {interview?.level?.replace('_', ' ')}
            </p>
          </div>

          {/* Overall Score Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8"
          >
            <div className="text-center">
              <div className="mb-6">
                {gradingReady ? (
                  passed ? (
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                    <CheckCircleIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
                  </div>
                  ) : (
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                    <XCircleIcon className="w-10 h-10 text-red-600 dark:text-red-400" />
                  </div>
                  )
                ) : (
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full mb-4">
                    <ChartBarIcon className="w-10 h-10 text-slate-500 dark:text-slate-300" />
                  </div>
                )}
                
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {gradingReady ? (passed ? 'Congratulations!' : 'Keep Practicing!') : 'Interview completed'}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {gradingReady
                    ? `You ${passed ? 'passed' : 'did not pass'} the interview`
                    : 'Answers were captured, but automatic grading was unavailable.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Overall Score</p>
                  <p className={`text-[clamp(1.75rem,8vw,2.25rem)] font-bold ${gradingReady ? getScoreColor(overallScore) : 'text-slate-500 dark:text-slate-300'}`}>
                    {gradingReady ? <AnimatedCounter value={`${overallScore}%`} /> : 'N/A'}
                  </p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-2">
                    {gradingReady ? <AnimatedCounter value={`${overallScore}/100`} /> : 'Not scored'}
                  </p>
                  <p className={`text-sm font-medium mt-2 ${
                    !gradingReady
                      ? 'text-slate-500'
                      : overallScore >= 70
                        ? 'text-green-600'
                        : overallScore >= 55
                          ? 'text-yellow-600'
                          : 'text-red-600 dark:text-red-400'
                  }`}>
                    {overallStatus}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {gradingReady
                      ? <>Answer marks <AnimatedCounter value={interviewSummary.totalMarks ?? 0} />/<AnimatedCounter value={interviewSummary.maxMarks ?? 0} /></>
                      : 'Answer marks unavailable until grading succeeds'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Grade</p>
                  <p className="text-[clamp(1.75rem,8vw,2.25rem)] font-bold text-gray-900 dark:text-white">
                    {gradingReady
                      ? (overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : overallScore >= 40 ? 'D' : 'F')
                      : 'N/A'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Status</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    gradingReady ? getScoreBgColor(overallScore) : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                  }`}>
                    {gradingReady ? (overallScore >= 55 ? 'Pass' : 'Fail') : 'Not auto-graded'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3 mb-8 text-center">
                {[
                  ['Asked', interviewSummary.questionsAsked],
                  ['Answered', interviewSummary.questionsAnswered],
                  ['Correct', interviewSummary.correct],
                  ['Partial', interviewSummary.partiallyCorrect],
                  ['Incorrect', interviewSummary.incorrect],
                  ['Unanswered', interviewSummary.unanswered],
                  ['Not auto-graded', interviewSummary.ungraded],
                  ['Accuracy', gradingReady ? `${interviewSummary.accuracyPercent ?? 0}%` : 'N/A'],
                  ['Camera attention', visualCards.cards.find((card) => card.key === 'cameraAttention')?.status || (cameraAttentionPercent != null ? `${cameraAttentionPercent}%` : '—')],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-gray-50 dark:bg-[#070b16] px-2 py-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      <AnimatedCounter value={value ?? 0} />
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={downloadReport}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                  Download PDF
                </button>
                <button
                  onClick={shareResults}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ShareIcon className="w-4 h-4 mr-2" />
                  Share Results
                </button>
              </div>
            </div>
          </motion.div>

          {/* Detailed Scores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Performance Breakdown
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Your performance across key skill areas. Each score is calculated independently.
              </p>
              
              <div className="space-y-4">
                {[
                  ['Visual confidence indicator', interviewSummary.confidenceScore, interviewSummary.hasVisualConfidence !== false && visual?.available, 'bg-blue-500'],
                  ['Communication', interviewSummary.communicationScore, interviewSummary.communicationScore != null, 'bg-green-500'],
                  ['Technical', interviewSummary.technicalScore, interviewSummary.hasTechnical === true, 'bg-purple-500'],
                  ['Problem solving', interviewSummary.problemSolvingScore, interviewSummary.hasProblemSolving === true, 'bg-orange-500'],
                ].map(([label, score, applicable, bar]) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {label}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {applicable ? (
                          <>
                            <AnimatedCounter value={`${score || 0}/100`} /> (<AnimatedCounter value={`${score || 0}%`} />)
                          </>
                        ) : 'Not applicable'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`${bar} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${applicable ? score || 0 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                AI Feedback
              </h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                    <ArrowUpIcon className="w-4 h-4 text-green-500 mr-2" />
                    Strengths
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {interviewSummary.strengths || results?.strengths || (interviewSummary.questionsAnswered === 0
                      ? 'No spoken answers were submitted.'
                      : 'No specific strengths identified.')}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                    <ArrowDownIcon className="w-4 h-4 text-red-500 mr-2" />
                    Areas for Improvement
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {interviewSummary.weaknesses || results?.weaknesses || 'No specific areas for improvement identified.'}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                    <ChartBarIcon className="w-4 h-4 text-blue-500 mr-2" />
                    Recommendations
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {interviewSummary.improvements || results?.improvements || 'Continue practicing to improve your skills.'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {questionRows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.42 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 mb-8"
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Question-by-question review
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Only questions that were actually asked. Scroll horizontally on smaller screens.
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-[1100px] w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-[#070b16]/70 text-gray-600 dark:text-gray-300">
                      <th className="px-3 py-3 font-semibold w-12 border-b border-gray-200 dark:border-gray-700">#</th>
                      <th className="px-3 py-3 font-semibold min-w-[180px] border-b border-gray-200 dark:border-gray-700">Question</th>
                      <th className="px-3 py-3 font-semibold min-w-[200px] border-b border-gray-200 dark:border-gray-700">Candidate Answer</th>
                      <th className="px-3 py-3 font-semibold w-36 border-b border-gray-200 dark:border-gray-700">Result</th>
                      <th className="px-3 py-3 font-semibold w-24 border-b border-gray-200 dark:border-gray-700">Score</th>
                      <th className="px-3 py-3 font-semibold min-w-[180px] border-b border-gray-200 dark:border-gray-700">Mistake / Missing Point</th>
                      <th className="px-3 py-3 font-semibold min-w-[180px] border-b border-gray-200 dark:border-gray-700">Ideal Answer</th>
                      <th className="px-3 py-3 font-semibold min-w-[180px] border-b border-gray-200 dark:border-gray-700">Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questionRows.map((row, index) => (
                      <tr
                        key={row.questionId || row.questionNumber}
                        className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/80 dark:bg-[#070b16]/40'}
                      >
                        <td className="px-3 py-4 align-top font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700">
                          {row.questionNumber}
                        </td>
                        <td className="px-3 py-4 align-top text-gray-900 dark:text-white whitespace-pre-wrap break-words border-b border-gray-100 dark:border-gray-700">
                          {row.question}
                        </td>
                        <td className="px-3 py-4 align-top text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words border-b border-gray-100 dark:border-gray-700">
                          {row.candidateAnswer || '— Unanswered —'}
                        </td>
                        <td className="px-3 py-4 align-top border-b border-gray-100 dark:border-gray-700">
                          <span className={`inline-flex max-w-full whitespace-normal text-center leading-snug px-2.5 py-1 rounded-full text-xs font-semibold ${resultBadgeClass(row.evaluation)}`}>
                            {row.resultLabel}
                          </span>
                        </td>
                        <td className="px-3 py-4 align-top whitespace-nowrap text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700">
                          {row.scored ? (
                            <>
                              <AnimatedCounter value={row.score} />/<AnimatedCounter value={row.maxScore} />
                            </>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-4 align-top text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words border-b border-gray-100 dark:border-gray-700">
                          {row.mistake || '—'}
                        </td>
                        <td className="px-3 py-4 align-top text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words border-b border-gray-100 dark:border-gray-700">
                          {row.idealAnswer || '—'}
                        </td>
                        <td className="px-3 py-4 align-top text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words border-b border-gray-100 dark:border-gray-700">
                          {row.feedback || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {results?.visualAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Visual analysis
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {visualCards.disclaimer}
              </p>
              {visualCards.available ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {visualCards.cards.map((card) => (
                      <div key={card.key} className="rounded-lg bg-gray-50 dark:bg-[#070b16] p-4 min-w-0 overflow-hidden">
                        <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white min-w-0 break-words pr-1">{card.label}</p>
                          <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            card.tone === 'good'
                              ? 'bg-green-100 text-green-800'
                              : card.tone === 'fair'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {card.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 break-words">{card.explanation}</p>
                      </div>
                    ))}
                  </div>
                  {visualCards.composure != null && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Visual confidence indicator: <AnimatedCounter value={`${visualCards.composure}/100`} />
                    </p>
                  )}
                  <details className="text-sm text-gray-500 dark:text-gray-400">
                    <summary className="cursor-pointer font-medium">Technical details</summary>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                      <p>Camera attention samples: {cameraAttentionPercent != null ? <AnimatedCounter value={`${cameraAttentionPercent}%`} /> : '—%'}</p>
                      <p>Face visible: {results.visualAnalysis.faceVisiblePercent != null ? <AnimatedCounter value={`${results.visualAnalysis.faceVisiblePercent}%`} /> : '—%'}</p>
                      <p>Looking away: {lookingAway != null ? <AnimatedCounter value={`${lookingAway}%`} /> : '—%'}</p>
                      <p>Head movement: {results.visualAnalysis.engagement?.headMovement || '—'}</p>
                    </div>
                  </details>
                </>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Camera visual analysis was not recorded for this session.
                </p>
              )}
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                What's Next?
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <ChartBarIcon className="w-8 h-8 text-blue-500 mb-2" />
                  <p className="font-medium text-gray-900 dark:text-white">Practice Again</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Start a new interview</p>
                </button>

                <button
                  onClick={() => navigate('/profile')}
                  className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <CheckCircleIcon className="w-8 h-8 text-green-500 mb-2" />
                  <p className="font-medium text-gray-900 dark:text-white">View Progress</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Track your improvement</p>
                </button>

                <button
                  onClick={() => navigate('/features')}
                  className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <ArrowUpIcon className="w-8 h-8 text-purple-500 mb-2" />
                  <p className="font-medium text-gray-900 dark:text-white">Upgrade</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Unlock premium features</p>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Results;
