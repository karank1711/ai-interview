import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

export default function FeatureCard({
  name,
  title,
  description,
  icon: Icon,
  route,
  cta = 'View Details',
  image,
  imageAlt,
  badge = 'Live',
  color = 'from-blue-500 to-purple-600',
}) {
  const heading = title || name;

  return (
    <article className="h-full">
      <Link
        to={route}
        className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-gray-100 transition-shadow hover:shadow-xl dark:bg-[#121a2e] dark:ring-white/10"
      >
        <div className="relative overflow-hidden rounded-t-2xl">
          <div className="aspect-[16/10] overflow-hidden bg-slate-900">
            {image ? (
              <img
                src={image}
                alt={imageAlt || heading}
                className="h-full w-full object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            ) : (
              <div className={`h-full w-full bg-gradient-to-r ${color}`} />
            )}
          </div>
          {badge ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              {badge}
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="mb-2 flex items-start gap-2">
            {Icon ? (
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r ${color} text-white`}>
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <h3 className="min-w-0 break-words text-lg font-bold text-gray-900 dark:text-white">{heading}</h3>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{description}</p>
          <div className="mt-auto flex items-center justify-between pt-1">
            <span className="inline-flex items-center text-sm font-medium text-blue-600 group-hover:underline dark:text-blue-400">
              {cta}
              <ArrowRightIcon className="ml-1 h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
