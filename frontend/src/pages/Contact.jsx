import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  EnvelopeIcon,
  LightBulbIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import HeroRobotBanner from '../components/HeroRobotBanner';
import SelectDropdown from '../components/SelectDropdown';
import { sendContactMessage } from '../services/contactService';
import { usePopup } from '../components/AppPopup';

const SUPPORT_CARDS = [
  {
    title: 'Quick Support',
    text: 'Get help from our team when you need it.',
    icon: ChatBubbleLeftRightIcon,
    wrap: 'bg-sky-100 text-sky-600',
  },
  {
    title: 'Expert Feedback',
    text: 'Ask us anything about interview practice.',
    icon: LightBulbIcon,
    wrap: 'bg-violet-100 text-violet-600',
  },
  {
    title: 'Your Feedback Matters',
    text: 'Tell us how we can improve InterviewIQ.',
    icon: SparklesIcon,
    wrap: 'bg-emerald-100 text-emerald-600',
  },
];

const Contact = () => {
  const { showPopup } = usePopup();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const composed = formData.subject
        ? `Subject: ${formData.subject}\n\n${formData.message}`
        : formData.message;
      await sendContactMessage({
        name: formData.name,
        email: formData.email,
        message: composed,
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
      showPopup({
        type: 'success',
        title: 'Message sent',
        message: 'Thanks for reaching out. We received your message and will reply soon.',
      });
    } catch (error) {
      showPopup({
        type: 'error',
        title: 'Could not send message',
        message: error.message || 'Failed to send your message. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 py-8 dark:bg-[#070b16]">
      <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
        <HeroRobotBanner
          badge="Get in touch"
          title="Contact Us"
          subtitle="We're here to help. Have a question, feedback, or need support? Reach out and we'll get back to you as soon as possible."
          variant="contact"
        />

        <div className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700 sm:p-8"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Send us a message</h2>
            <p className="mt-1 text-sm text-slate-500">Fill out the form below and we'll get back to you shortly.</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="Enter your name"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="Enter your email address"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Subject</label>
                <SelectDropdown
                  name="subject"
                  aria-label="Subject"
                  value={formData.subject}
                  onChange={(subject) => setFormData({ ...formData, subject })}
                  disabled={loading}
                  placeholder="Select a subject"
                  options={[
                    { value: 'Support', label: 'Support' },
                    { value: 'Feedback', label: 'Feedback' },
                    { value: 'Partnership', label: 'Partnership' },
                    { value: 'Other', label: 'Other' },
                  ]}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Message</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={4}
                  required
                  disabled={loading}
                  placeholder="Type your message here..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-blue-600 hover:to-violet-700 disabled:opacity-50"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </motion.div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700 sm:p-8"
            >
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Get in touch</h2>
              <p className="mt-1 text-sm text-slate-500">We typically reply within 24 hours.</p>
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                    <EnvelopeIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Email</h3>
                    <a href="mailto:karank47417@gmail.com" className="text-sm text-slate-500 hover:text-blue-500">
                      karank47417@gmail.com
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <PhoneIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Phone</h3>
                    <a href="tel:+918383075384" className="text-sm text-slate-500 hover:text-emerald-600">
                      +91 8383075384
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                    <MapPinIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Office</h3>
                    <p className="text-sm text-slate-500">Faridabad, Sec-91</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700 sm:p-8">
              <div className="mb-4 flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-violet-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Business Hours</h2>
              </div>
              <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                <p>Monday – Friday: 9:00 AM – 6:00 PM PST</p>
                <p>Saturday: 10:00 AM – 4:00 PM PST</p>
                <p>Sunday: Closed</p>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-4 overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-50 via-sky-50 to-violet-100 p-6 dark:from-slate-800 dark:to-indigo-950 sm:p-10">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-[clamp(1.35rem,5vw,1.875rem)] font-bold text-slate-900 dark:text-white">Let's Build Something Great Together</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              Whether you need help practicing interviews or want to share feedback, we're ready when you are.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {SUPPORT_CARDS.map((card) => (
              <article key={card.title} className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-800">
                <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${card.wrap}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">{card.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{card.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Contact;
