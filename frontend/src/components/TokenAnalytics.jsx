import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import AnimatedCounter from './AnimatedCounter';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

function isDarkTheme() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

function baseOptions() {
  const dark = isDarkTheme();
  const tick = dark ? '#94a3b8' : '#64748b';
  const grid = dark ? 'rgba(148,163,184,0.16)' : 'rgba(148,163,184,0.22)';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: tick, boxWidth: 10, usePointStyle: true, padding: 16 },
      },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { ticks: { color: tick }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: tick, precision: 0 }, grid: { color: grid } },
    },
  };
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-52 items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
      <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      {children}
    </div>
  );
}

export default function TokenAnalytics({ charts = [] }) {
  const options = useMemo(() => baseOptions(), []);

  return (
    <>
      {charts.map((chart) => (
        <ChartCard key={chart.id} title={chart.title}>
          {!chart.hasData ? (
            <EmptyChart message={chart.empty} />
          ) : chart.type === 'grouped-bar' ? (
            <div className="h-52">
              <Bar
                options={options}
                data={{
                  labels: chart.labels,
                  datasets: chart.series.map((series) => ({
                    label: series.label,
                    data: series.data,
                    backgroundColor: series.color,
                    borderRadius: 8,
                    barPercentage: 0.55,
                    categoryPercentage: 0.7,
                  })),
                }}
              />
            </div>
          ) : chart.type === 'bar' ? (
            <div className="h-52">
              <Bar
                options={{ ...options, plugins: { ...options.plugins, legend: { display: false } } }}
                data={{
                  labels: chart.labels,
                  datasets: [{
                    data: chart.values,
                    backgroundColor: chart.colors || chart.color,
                    borderRadius: 8,
                  }],
                }}
              />
            </div>
          ) : chart.type === 'line' ? (
            <div className="h-52">
              <Line
                options={{ ...options, plugins: { ...options.plugins, legend: { display: false } } }}
                data={{
                  labels: chart.labels,
                  datasets: [{
                    data: chart.values,
                    borderColor: chart.color,
                    backgroundColor: `${chart.color}22`,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: chart.color,
                  }],
                }}
              />
            </div>
          ) : chart.type === 'doughnut' ? (
            <div className="relative mx-auto h-52 w-52">
              <Doughnut
                options={{
                  cutout: '72%',
                  plugins: { legend: { display: false }, tooltip: { enabled: true } },
                }}
                data={{
                  labels: chart.slices.map((slice) => slice.label),
                  datasets: [{
                    data: chart.slices.map((slice) => slice.value),
                    backgroundColor: chart.slices.map((slice) => slice.color),
                    borderWidth: 0,
                  }],
                }}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  <AnimatedCounter value={chart.centerValue} />
                </p>
              </div>
            </div>
          ) : chart.type === 'breakdown' ? (
            <ul className="space-y-4">
              {chart.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    <AnimatedCounter value={`${item.value}%`} />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </ChartCard>
      ))}
    </>
  );
}
